import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { createApiKey, resolveApiKeyAuth, revokeApiKey } from "../lib/auth/api-keys";

describe("API key authentication", () => {
  const suffix = Date.now().toString();
  let user: { id: string };
  let domainA: { id: string };
  let domainB: { id: string };

  beforeAll(async () => {
    user = await db.user.create({ data: { username: `api-key-user-${suffix}`, passwordHash: "test", role: "USER" }, select: { id: true } });
    domainA = await db.domain.create({ data: { hostname: `api-key-a-${suffix}.example.test`, name: "A", memberships: { create: { userId: user.id, role: "USER" } } }, select: { id: true } });
    domainB = await db.domain.create({ data: { hostname: `api-key-b-${suffix}.example.test`, name: "B", memberships: { create: { userId: user.id, role: "ADMIN" } } }, select: { id: true } });
  });

  afterAll(async () => {
    await db.domain.deleteMany({ where: { id: { in: [domainA.id, domainB.id] } } });
    await db.user.deleteMany({ where: { id: user.id } });
    await db.$disconnect();
  });

  it("authenticates a valid key scoped to its own domain, inheriting the live membership role", async () => {
    const { token } = await createApiKey({ domainId: domainA.id, userId: user.id, label: "test" });
    const result = await resolveApiKeyAuth(token, domainA.id, "1.2.3.4");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.user.id).toBe(user.id);
      expect(result.membership.role).toBe("USER");
    }
  });

  it("rejects a key presented against a domain it was not issued for", async () => {
    const { token } = await createApiKey({ domainId: domainA.id, userId: user.id, label: "test" });
    const result = await resolveApiKeyAuth(token, domainB.id, "1.2.3.5");
    expect(result.status).toBe("invalid");
  });

  it("reflects the live membership role rather than a snapshot", async () => {
    const { token } = await createApiKey({ domainId: domainB.id, userId: user.id, label: "test" });
    const result = await resolveApiKeyAuth(token, domainB.id, "1.2.3.6");
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.membership.role).toBe("ADMIN");
  });

  it("rejects a garbage token", async () => {
    const result = await resolveApiKeyAuth("slk_not-a-real-token", domainA.id, "1.2.3.7");
    expect(result.status).toBe("invalid");
  });

  it("rejects a revoked key", async () => {
    const { apiKey, token } = await createApiKey({ domainId: domainA.id, userId: user.id, label: "revoke-me" });
    await revokeApiKey(domainA.id, user.id, apiKey.id);
    const result = await resolveApiKeyAuth(token, domainA.id, "1.2.3.8");
    expect(result.status).toBe("invalid");
  });

  it("rejects an expired key", async () => {
    const { token } = await createApiKey({ domainId: domainA.id, userId: user.id, label: "expired", expiresAt: new Date(Date.now() - 1000) });
    const result = await resolveApiKeyAuth(token, domainA.id, "1.2.3.9");
    expect(result.status).toBe("invalid");
  });

  it("rejects a key once its membership is removed", async () => {
    const otherUser = await db.user.create({ data: { username: `api-key-removed-${suffix}`, passwordHash: "test" } });
    const membership = await db.domainMembership.create({ data: { domainId: domainA.id, userId: otherUser.id, role: "USER" } });
    const { token } = await createApiKey({ domainId: domainA.id, userId: otherUser.id, label: "soon-removed" });
    await db.domainMembership.delete({ where: { id: membership.id } });
    const result = await resolveApiKeyAuth(token, domainA.id, "1.2.3.10");
    expect(result.status).toBe("invalid");
    await db.user.delete({ where: { id: otherUser.id } });
  });

  it("rate limits a key after too many requests in the window", async () => {
    const { token } = await createApiKey({ domainId: domainA.id, userId: user.id, label: "rate-limited" });
    let sawRateLimit = false;
    for (let i = 0; i < 310; i++) {
      const result = await resolveApiKeyAuth(token, domainA.id, "9.9.9.9");
      if (result.status === "rate_limited") { sawRateLimit = true; break; }
    }
    expect(sawRateLimit).toBe(true);
  });
});
