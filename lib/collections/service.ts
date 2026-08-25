import { db } from "@/lib/db";

export async function createCollection(input: { ownerId: string; name: string; description?: string; isPrivate?: boolean }) {
  const name = input.name.trim();
  if (!name || name.length > 100) throw new Error("Collection name must be 1–100 characters");
  return db.collection.create({ data: {
    ownerId: input.ownerId,
    name,
    description: input.description?.trim() || null,
    isPrivate: input.isPrivate ?? true,
  } });
}

export async function listCollections(ownerId: string) {
  return db.collection.findMany({ where: { OR: [{ ownerId }, { isPrivate: false }] }, orderBy: { name: "asc" } });
}

export async function setLinkCollections(shortLinkId: string, collectionIds: string[]) {
  const ids = [...new Set(collectionIds)];
  return db.$transaction(async tx => {
    await tx.linkCollection.deleteMany({ where: { shortLinkId } });
    if (ids.length) await tx.linkCollection.createMany({ data: ids.map(collectionId => ({ shortLinkId, collectionId })) });
    return tx.shortLink.findUnique({ where: { id: shortLinkId }, include: { collections: { include: { collection: true } } } });
  });
}
