import { db } from "@/lib/db";

export async function createCollection(input: { domainId: string; ownerId: string; name: string; description?: string; isPrivate?: boolean }) {
  const name = input.name.trim();
  if (!name || name.length > 100) throw new Error("Collection name must be 1–100 characters");
  return db.collection.create({ data: {
    domainId: input.domainId,
    ownerId: input.ownerId,
    name,
    description: input.description?.trim() || null,
    isPrivate: input.isPrivate ?? true,
  } });
}

export async function listCollections(domainId: string, ownerId: string) {
  return db.collection.findMany({
    where: { domainId, OR: [{ ownerId }, { isPrivate: false }] },
    orderBy: { name: "asc" },
  });
}

export async function setLinkCollections(shortLinkId: string, domainId: string, collectionIds: string[]) {
  const ids = [...new Set(collectionIds)];
  return db.$transaction(async tx => {
    const link = await tx.shortLink.findFirst({ where: { id: shortLinkId, domainId } });
    if (!link) throw new Error("Link not found");

    if (ids.length) {
      const collections = await tx.collection.findMany({
        where: { id: { in: ids }, domainId },
        select: { id: true },
      });
      if (collections.length !== ids.length) throw new Error("Collection does not belong to the current domain");
    }

    await tx.linkCollection.deleteMany({ where: { shortLinkId } });
    if (ids.length) await tx.linkCollection.createMany({ data: ids.map(collectionId => ({ shortLinkId, collectionId })) });
    return tx.shortLink.findUnique({ where: { id: shortLinkId }, include: { collections: { include: { collection: true } } } });
  });
}
