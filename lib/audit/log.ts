import { randomBytes, createHmac } from "node:crypto";
import { db } from "@/lib/db";

export type AuthMethod = "session" | "api_key";

const AUDIT_LOG_RETENTION_DAYS = 180;

function requireAuditHashSecret(): string {
  const secret = process.env.AUDIT_HASH_SECRET;
  if (!secret) throw new Error("AUDIT_HASH_SECRET is required");
  return secret;
}

/** Lazily creates a per-user salt. Cascade-deleted with the User row (see schema) — this is
 *  what makes the pseudonym below permanently unrecoverable once an account is deleted. */
async function getOrCreateUserSalt(userId: string): Promise<string | null> {
  const existing = await db.userAuditSalt.findUnique({ where: { userId } });
  if (existing) return existing.salt;
  try {
    const created = await db.userAuditSalt.create({ data: { userId, salt: randomBytes(32).toString("hex") } });
    return created.salt;
  } catch {
    // Concurrent creation, or the user no longer exists (FK violation) — either way, re-check.
    const retried = await db.userAuditSalt.findUnique({ where: { userId } });
    return retried?.salt ?? null;
  }
}

/** Never returns/stores a raw userId. Deterministic while the account exists; permanently
 *  unrecoverable once its salt is gone (the account was deleted), even with DB + secret access. */
export async function computeActorPseudonym(userId: string): Promise<string | null> {
  const salt = await getOrCreateUserSalt(userId);
  if (!salt) return null;
  return createHmac("sha256", requireAuditHashSecret()).update(`${salt}:${userId}`).digest("hex");
}

/** Distinguishes which API key performed an action, without ever storing the raw apiKeyId —
 *  that alone would 1:1-join back to a user via ApiKey.userId, bypassing the reveal/log
 *  requirement built for actorPseudonym above. No per-key salt is needed: an apiKeyId is
 *  already a high-entropy, unenumerable id, and it's cascade-deleted with its owning User —
 *  once gone, this pseudonym has nothing left to be recomputed from. Deterministic, so a key's
 *  own owner can always resolve their own entries back to a label by recomputing this for each
 *  of their own keys. */
export function computeApiKeyPseudonym(apiKeyId: string): string {
  return createHmac("sha256", requireAuditHashSecret()).update(apiKeyId).digest("hex");
}

export async function recordAuditEvent(input: { domainId: string; userId: string; authMethod: AuthMethod; apiKeyId?: string | null; action: string; resourceType?: string; resourceId?: string }): Promise<void> {
  try {
    const actorPseudonym = await computeActorPseudonym(input.userId);
    if (!actorPseudonym) return;
    await db.auditLogEntry.create({
      data: {
        domainId: input.domainId,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        actorPseudonym,
        apiKeyPseudonym: input.apiKeyId ? computeApiKeyPseudonym(input.apiKeyId) : null,
        authMethod: input.authMethod,
      },
    });
  } catch (error) {
    // Audit logging is best-effort: a misconfigured secret or a transient DB error here must
    // never fail the mutation it's describing. Surface it loudly so it doesn't go unnoticed.
    console.error("audit log write failed", error);
  }
}

/** A user's own activity within one domain — always available via self-service, no reveal needed.
 *  Resolves api_key entries back to the caller's own key labels client-side; nothing here lets
 *  anyone resolve a key that isn't their own. */
export async function getOwnAuditLog(userId: string, domainId: string, limit = 200) {
  const actorPseudonym = await computeActorPseudonym(userId);
  if (!actorPseudonym) return [];
  const [entries, ownKeys] = await Promise.all([
    db.auditLogEntry.findMany({ where: { domainId, actorPseudonym }, orderBy: { createdAt: "desc" }, take: limit }),
    db.apiKey.findMany({ where: { domainId, userId }, select: { id: true, label: true } }),
  ]);
  const labelByPseudonym = new Map(ownKeys.map(k => [computeApiKeyPseudonym(k.id), k.label]));
  return entries.map(e => ({ ...e, apiKeyLabel: e.apiKeyPseudonym ? (labelByPseudonym.get(e.apiKeyPseudonym) ?? null) : null }));
}

/** Domain-admin-only: resolves one member's pseudonymized entries to their identity. The reveal
 *  itself is logged — attributed (pseudonymously) to the admin, naming the pseudonym it resolved
 *  rather than the target's raw userId — so the power to de-anonymize is never silent. */
export async function getMemberAuditLog(domainId: string, admin: { userId: string; authMethod: AuthMethod; apiKeyId?: string | null }, targetUserId: string, limit = 200) {
  const targetPseudonym = await computeActorPseudonym(targetUserId);
  if (!targetPseudonym) return [];
  const entries = await db.auditLogEntry.findMany({ where: { domainId, actorPseudonym: targetPseudonym }, orderBy: { createdAt: "desc" }, take: limit });
  await recordAuditEvent({ domainId, userId: admin.userId, authMethod: admin.authMethod, apiKeyId: admin.apiKeyId, action: "auditlog.reveal", resourceType: "user", resourceId: targetPseudonym });
  return entries;
}

export async function purgeExpiredAuditLog(retentionDays = AUDIT_LOG_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86400000);
  const result = await db.auditLogEntry.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}
