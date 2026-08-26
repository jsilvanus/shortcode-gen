import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { computeActorPseudonym, getMemberAuditLog, getOwnAuditLog, purgeExpiredAuditLog, recordAuditEvent } from "../lib/audit/log";

describe("audit log", () => {
  const suffix = Date.now().toString();
  let member: { id: string };
  let admin: { id: string };
  let domain: { id: string };

  beforeAll(async () => {
    member = await db.user.create({ data: { username: `audit-member-${suffix}`, passwordHash: "test" }, select: { id: true } });
    admin = await db.user.create({ data: { username: `audit-admin-${suffix}`, passwordHash: "test" }, select: { id: true } });
    domain = await db.domain.create({
      data: {
        hostname: `audit-${suffix}.example.test`,
        name: "Audit domain",
        memberships: { create: [{ userId: member.id, role: "USER" }, { userId: admin.id, role: "ADMIN" }] },
      },
      select: { id: true },
    });
  });

  afterAll(async () => {
    await db.auditLogEntry.deleteMany({ where: { domainId: domain.id } });
    await db.domain.delete({ where: { id: domain.id } });
    await db.user.deleteMany({ where: { id: { in: [member.id, admin.id] } } });
    await db.$disconnect();
  });

  it("is deterministic for the same user and differs across users", async () => {
    const a1 = await computeActorPseudonym(member.id);
    const a2 = await computeActorPseudonym(member.id);
    const b = await computeActorPseudonym(admin.id);
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).not.toContain(member.id);
  });

  it("records an event and makes it visible via self-service, but never stores the raw userId", async () => {
    await recordAuditEvent({ domainId: domain.id, userId: member.id, authMethod: "session", action: "link.create", resourceType: "ShortLink", resourceId: "link-1" });
    const own = await getOwnAuditLog(member.id, domain.id);
    expect(own.some(e => e.action === "link.create" && e.resourceId === "link-1")).toBe(true);
    for (const entry of own) {
      expect(entry.actorPseudonym).not.toBe(member.id);
      expect((entry as any).userId).toBeUndefined();
    }
  });

  it("keeps one user's entries invisible in another user's self-service view", async () => {
    const adminOwn = await getOwnAuditLog(admin.id, domain.id);
    expect(adminOwn.some(e => e.resourceId === "link-1")).toBe(false);
  });

  it("lets a domain admin resolve a specific member's entries, and logs the reveal itself", async () => {
    await recordAuditEvent({ domainId: domain.id, userId: member.id, authMethod: "api_key", action: "link.delete", resourceType: "ShortLink", resourceId: "link-2" });
    const revealed = await getMemberAuditLog(domain.id, { userId: admin.id, authMethod: "session" }, member.id);
    expect(revealed.some(e => e.resourceId === "link-2")).toBe(true);

    const memberPseudonym = await computeActorPseudonym(member.id);
    const adminPseudonym = await computeActorPseudonym(admin.id);
    const reveals = await db.auditLogEntry.findMany({ where: { domainId: domain.id, action: "auditlog.reveal" } });
    expect(reveals.some(r => r.actorPseudonym === adminPseudonym && r.resourceId === memberPseudonym)).toBe(true);
    // The reveal's own log row still never names the target's raw userId.
    expect(reveals.every(r => r.resourceId !== member.id)).toBe(true);
  });

  it("crypto-shreds: deleting the user cascades away their salt, permanently unlinking their history", async () => {
    const toDelete = await db.user.create({ data: { username: `audit-shred-${suffix}`, passwordHash: "test" }, select: { id: true } });
    await db.domainMembership.create({ data: { domainId: domain.id, userId: toDelete.id, role: "USER" } });
    await recordAuditEvent({ domainId: domain.id, userId: toDelete.id, authMethod: "session", action: "link.create", resourceType: "ShortLink", resourceId: "link-shred" });
    const pseudonymBeforeDeletion = await computeActorPseudonym(toDelete.id);
    const entryBefore = await db.auditLogEntry.findFirst({ where: { domainId: domain.id, resourceId: "link-shred" } });
    expect(entryBefore?.actorPseudonym).toBe(pseudonymBeforeDeletion);

    await db.user.delete({ where: { id: toDelete.id } });

    expect(await db.userAuditSalt.findUnique({ where: { userId: toDelete.id } })).toBeNull();
    // The historical entry is untouched — the log's integrity for everyone else is preserved...
    const entryAfter = await db.auditLogEntry.findFirst({ where: { domainId: domain.id, resourceId: "link-shred" } });
    expect(entryAfter?.actorPseudonym).toBe(pseudonymBeforeDeletion);
    // ...but it can never again be resolved back to that person: recomputing needs the salt,
    // which is gone, so a freshly-generated one (for a userId that no longer even exists) can
    // only fail to match, not accidentally reproduce the old value.
    expect(await computeActorPseudonym(toDelete.id)).toBeNull();
  });

  it("purges entries older than the retention window without touching recent ones", async () => {
    const old = await db.auditLogEntry.create({ data: { domainId: domain.id, action: "link.create", actorPseudonym: "old-pseudonym", authMethod: "session", createdAt: new Date(Date.now() - 200 * 86400000) } });
    const recent = await db.auditLogEntry.create({ data: { domainId: domain.id, action: "link.create", actorPseudonym: "recent-pseudonym", authMethod: "session" } });
    const purged = await purgeExpiredAuditLog(180);
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(await db.auditLogEntry.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await db.auditLogEntry.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });
});
