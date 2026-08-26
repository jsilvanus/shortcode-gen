import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { getDomainMembership } from "@/lib/domain";

const TOKEN_PREFIX = "slk_";
const TOKEN_BYTES = 32;
const PREFIX_LENGTH = 8;

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 300;
const INVALID_KEY_WINDOW_MS = 5 * 60 * 1000;
const INVALID_KEY_MAX_ATTEMPTS = 30;

export function generateApiKeyToken(): { token: string; prefix: string } {
  const token = TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString("base64url");
  const prefix = token.slice(TOKEN_PREFIX.length, TOKEN_PREFIX.length + PREFIX_LENGTH);
  return { token, prefix };
}

export function hashApiKeyToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeHashEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function createApiKey(input: { domainId: string; userId: string; label: string; expiresAt?: Date | null }) {
  const { token, prefix } = generateApiKeyToken();
  const apiKey = await db.apiKey.create({
    data: { domainId: input.domainId, userId: input.userId, label: input.label, keyPrefix: prefix, keyHash: hashApiKeyToken(token), expiresAt: input.expiresAt ?? null },
  });
  return { apiKey, token };
}

export async function listApiKeys(domainId: string, userId: string) {
  return db.apiKey.findMany({
    where: { domainId, userId },
    select: { id: true, label: true, keyPrefix: true, createdAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeApiKey(domainId: string, userId: string, id: string) {
  return db.apiKey.updateMany({ where: { id, domainId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

async function checkRateLimit(key: string, windowMs: number, maxAttempts: number): Promise<boolean> {
  const now = new Date();
  const existing = await db.apiRequestAttempt.findUnique({ where: { key } });
  if (!existing || existing.resetAt <= now) {
    await db.apiRequestAttempt.upsert({ where: { key }, create: { key, count: 1, resetAt: new Date(now.getTime() + windowMs) }, update: { count: 1, resetAt: new Date(now.getTime() + windowMs) } });
    return true;
  }
  if (existing.count >= maxAttempts) return false;
  await db.apiRequestAttempt.update({ where: { key }, data: { count: { increment: 1 } } });
  return true;
}

export type ApiKeyAuthResult =
  | { status: "ok"; user: NonNullable<Awaited<ReturnType<typeof db.user.findUnique>>>; membership: { role: string }; apiKeyId: string }
  | { status: "invalid" }
  | { status: "rate_limited" };

/**
 * Resolves a bearer token into a (user, membership) pair scoped to the given domain.
 * A key issued for a different domain than the one being requested is treated as invalid.
 */
export async function resolveApiKeyAuth(token: string, domainId: string, clientIp: string): Promise<ApiKeyAuthResult> {
  async function rejectAsInvalid(): Promise<ApiKeyAuthResult> {
    // Only invalid/unrecognized tokens count against the IP guessing-guard bucket,
    // so a valid key's own (much higher) per-key limit is the only thing that throttles it.
    if (!(await checkRateLimit(`invalid:${clientIp}`, INVALID_KEY_WINDOW_MS, INVALID_KEY_MAX_ATTEMPTS))) return { status: "rate_limited" };
    return { status: "invalid" };
  }

  if (!token.startsWith(TOKEN_PREFIX)) return rejectAsInvalid();
  const prefix = token.slice(TOKEN_PREFIX.length, TOKEN_PREFIX.length + PREFIX_LENGTH);
  const apiKey = await db.apiKey.findUnique({ where: { keyPrefix: prefix }, include: { user: true } });
  if (!apiKey || !safeHashEquals(hashApiKeyToken(token), apiKey.keyHash)) return rejectAsInvalid();
  if (apiKey.revokedAt) return rejectAsInvalid();
  if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) return rejectAsInvalid();
  if (apiKey.domainId !== domainId) return rejectAsInvalid();

  if (!(await checkRateLimit(`key:${apiKey.id}`, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS))) return { status: "rate_limited" };

  const membership = await getDomainMembership(apiKey.userId, domainId);
  if (!membership) return rejectAsInvalid();

  db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);

  return { status: "ok", user: apiKey.user, membership: { role: membership.role }, apiKeyId: apiKey.id };
}
