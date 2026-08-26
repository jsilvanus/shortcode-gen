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

export async function recordAuditEvent(input: { domainId: string; userId: string; authMethod: AuthMethod; action: string; resourceType?: string; resourceId?: string }): Promise<void> {
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
        authMethod: input.authMethod,
      },
    });
  } catch (error) {
    // Audit logging is best-effort: a misconfigured secret or a transient DB error here must
    // never fail the mutation it's describing. Surface it loudly so it doesn't go unnoticed.
    console.error("audit log write failed", error);
  }
}

/** A user's own activity within one domain — always available via self-service, no reveal needed. */
export async function getOwnAuditLog(userId: string, domainId: string, limit = 200) {
  const actorPseudonym = await computeActorPseudonym(userId);
  if (!actorPseudonym) return [];
  return db.auditLogEntry.findMany({ where: { domainId, actorPseudonym }, orderBy: { createdAt: "desc" }, take: limit });
}

/** Domain-admin-only: resolves one member's pseudonymized entries to their identity. The reveal
 *  itself is logged — attributed (pseudonymously) to the admin, naming the pseudonym it resolved
 *  rather than the target's raw userId — so the power to de-anonymize is never silent. */
export async function getMemberAuditLog(domainId: string, admin: { userId: string; authMethod: AuthMethod }, targetUserId: string, limit = 200) {
  const targetPseudonym = await computeActorPseudonym(targetUserId);
  if (!targetPseudonym) return [];
  const entries = await db.auditLogEntry.findMany({ where: { domainId, actorPseudonym: targetPseudonym }, orderBy: { createdAt: "desc" }, take: limit });
  await recordAuditEvent({ domainId, userId: admin.userId, authMethod: admin.authMethod, action: "auditlog.reveal", resourceType: "user", resourceId: targetPseudonym });
  return entries;
}

export async function purgeExpiredAuditLog(retentionDays = AUDIT_LOG_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86400000);
  const result = await db.auditLogEntry.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}
