import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { getActiveDomainByHostname, getDomainRole } from "../lib/domain";
import { setLinkCollections } from "../lib/collections/service";

describe("multi-domain database isolation", () => {
  const suffix = Date.now().toString();
  let userA: { id: string };
  let userB: { id: string };
  let domainA: { id: string };
  let domainB: { id: string };

  beforeAll(async () => {
    userA = await db.user.create({ data: { username: `domain-a-${suffix}`, passwordHash: "test", role: "USER" }, select: { id: true } });
    userB = await db.user.create({ data: { username: `domain-b-${suffix}`, passwordHash: "test", role: "USER" }, select: { id: true } });
    domainA = await db.domain.create({ data: { hostname: `short-a-${suffix}.example.test`, name: "Domain A", memberships: { create: { userId: userA.id, role: "ADMIN" } }, aliases: { create: { hostname: `alias-a-${suffix}.example.test` } } }, select: { id: true } });
    domainB = await db.domain.create({ data: { hostname: `short-b-${suffix}.example.test`, name: "Domain B", memberships: { create: { userId: userB.id, role: "ADMIN" } } }, select: { id: true } });
    await db.shortLink.createMany({ data: [
      { domainId: domainA.id, code: "kirkko", codeType: "custom", targetUrl: "https://a.example.test", ownerId: userA.id },
      { domainId: domainB.id, code: "kirkko", codeType: "custom", targetUrl: "https://b.example.test", ownerId: userB.id },
    ] });
  });

  afterAll(async () => {
    await db.domain.deleteMany({ where: { id: { in: [domainA.id, domainB.id] } } });
    await db.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await db.$disconnect();
  });

  it("resolves the canonical hostname and alias to the same domain", async () => {
    expect((await getActiveDomainByHostname(`SHORT-A-${suffix}.EXAMPLE.TEST.`))?.id).toBe(domainA.id);
    expect((await getActiveDomainByHostname(`ALIAS-A-${suffix}.EXAMPLE.TEST`))?.id).toBe(domainA.id);
  });

  it("resolves aliases to the same links as the canonical hostname", async () => {
    const canonicalDomain = await getActiveDomainByHostname(`short-a-${suffix}.example.test`);
    const aliasDomain = await getActiveDomainByHostname(`alias-a-${suffix}.example.test`);
    expect(canonicalDomain?.id).toBe(aliasDomain?.id);
    const [canonicalLink, aliasLink] = await Promise.all([
      db.shortLink.findUnique({ where: { domainId_code: { domainId: canonicalDomain!.id, code: "kirkko" } } }),
      db.shortLink.findUnique({ where: { domainId_code: { domainId: aliasDomain!.id, code: "kirkko" } } }),
    ]);
    expect(aliasLink?.id).toBe(canonicalLink?.id);
    expect(aliasLink?.targetUrl).toBe("https://a.example.test");
  });

  it("allows the same code in separate domains", async () => {
    const links = await db.shortLink.findMany({ where: { code: "kirkko" } });
    expect(links).toHaveLength(2);
    expect(new Set(links.map((link) => link.domainId))).toEqual(new Set([domainA.id, domainB.id]));
  });

  it("uses the compound domain/code key for link resolution", async () => {
    expect((await db.shortLink.findUnique({ where: { domainId_code: { domainId: domainA.id, code: "kirkko" } } }))?.targetUrl).toBe("https://a.example.test");
    expect((await db.shortLink.findUnique({ where: { domainId_code: { domainId: domainB.id, code: "kirkko" } } }))?.targetUrl).toBe("https://b.example.test");
  });

  it("keeps memberships and roles isolated by domain", async () => {
    expect(await getDomainRole(userA.id, domainA.id)).toBe("ADMIN");
    expect(await getDomainRole(userA.id, domainB.id)).toBeNull();
    expect(await getDomainRole(userB.id, domainB.id)).toBe("ADMIN");
    expect(await getDomainRole(userB.id, domainA.id)).toBeNull();
  });

  it("rejects collection relationships that cross domains", async () => {
    const collectionA = await db.collection.create({ data: { domainId: domainA.id, name: `Collection ${suffix}`, ownerId: userA.id }, select: { id: true } });
    const linkB = await db.shortLink.findUniqueOrThrow({ where: { domainId_code: { domainId: domainB.id, code: "kirkko" } }, select: { id: true } });
    await expect(setLinkCollections(linkB.id, domainB.id, [collectionA.id])).rejects.toThrow("Collection does not belong to the current domain");
  });
});
