import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getActiveDomainByHostname, getDomainRole } from "@/lib/domain";

describe("multi-domain database isolation", () => {
  const suffix = Date.now().toString();
  let userA: { id: string };
  let userB: { id: string };
  let domainA: { id: string };
  let domainB: { id: string };

  beforeAll(async () => {
    userA = await db.user.create({
      data: { username: `domain-a-${suffix}`, passwordHash: "test", role: "USER" },
      select: { id: true },
    });
    userB = await db.user.create({
      data: { username: `domain-b-${suffix}`, passwordHash: "test", role: "USER" },
      select: { id: true },
    });

    domainA = await db.domain.create({
      data: {
        hostname: `short-a-${suffix}.example.test`,
        name: "Domain A",
        memberships: { create: { userId: userA.id, role: "ADMIN" } },
        aliases: { create: { hostname: `alias-a-${suffix}.example.test` } },
      },
      select: { id: true },
    });
    domainB = await db.domain.create({
      data: {
        hostname: `short-b-${suffix}.example.test`,
        name: "Domain B",
        memberships: { create: { userId: userB.id, role: "ADMIN" } },
      },
      select: { id: true },
    });

    await db.shortLink.createMany({
      data: [
        { domainId: domainA.id, code: "kirkko", codeType: "custom", targetUrl: "https://a.example.test", ownerId: userA.id },
        { domainId: domainB.id, code: "kirkko", codeType: "custom", targetUrl: "https://b.example.test", ownerId: userB.id },
      ],
    });
  });

  afterAll(async () => {
    await db.domain.deleteMany({ where: { id: { in: [domainA.id, domainB.id] } } });
    await db.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await db.$disconnect();
  });

  it("resolves the canonical hostname and alias to the same domain", async () => {
    const canonical = await getActiveDomainByHostname(`SHORT-A-${suffix}.EXAMPLE.TEST.`);
    const alias = await getActiveDomainByHostname(`ALIAS-A-${suffix}.EXAMPLE.TEST`);

    expect(canonical?.id).toBe(domainA.id);
    expect(alias?.id).toBe(domainA.id);
  });

  it("allows the same code in separate domains", async () => {
    const links = await db.shortLink.findMany({ where: { code: "kirkko" }, orderBy: { domainId: "asc" } });
    expect(links).toHaveLength(2);
    expect(new Set(links.map((link) => link.domainId))).toEqual(new Set([domainA.id, domainB.id]));
    expect(links.map((link) => link.targetUrl).sort()).toEqual(["https://a.example.test", "https://b.example.test"]);
  });

  it("cannot resolve a link from another domain through a domain-scoped lookup", async () => {
    const linkForA = await db.shortLink.findUnique({ where: { domainId_code: { domainId: domainA.id, code: "kirkko" } } });
    const linkForB = await db.shortLink.findUnique({ where: { domainId_code: { domainId: domainB.id, code: "kirkko" } } });

    expect(linkForA?.targetUrl).toBe("https://a.example.test");
    expect(linkForB?.targetUrl).toBe("https://b.example.test");
  });

  it("keeps memberships and roles isolated by domain", async () => {
    expect(await getDomainRole(userA.id, domainA.id)).toBe("ADMIN");
    expect(await getDomainRole(userA.id, domainB.id)).toBeNull();
    expect(await getDomainRole(userB.id, domainB.id)).toBe("ADMIN");
    expect(await getDomainRole(userB.id, domainA.id)).toBeNull();
  });

  it("does not allow a collection relationship to cross domains", async () => {
    const collectionA = await db.collection.create({
      data: { domainId: domainA.id, name: `Collection ${suffix}`, ownerId: userA.id },
      select: { id: true },
    });

    const linkB = await db.shortLink.findUniqueOrThrow({
      where: { domainId_code: { domainId: domainB.id, code: "kirkko" } },
      select: { id: true },
    });

    await expect(
      db.linkCollection.create({ data: { shortLinkId: linkB.id, collectionId: collectionA.id } }),
    ).rejects.toThrow();
  });
});
