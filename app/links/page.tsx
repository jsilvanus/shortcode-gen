import { db } from "@/lib/db";
import { LinkDashboard } from "@/components/links/link-dashboard";

export default async function LinksPage() {
  // TODO: replace this placeholder with the authenticated session user.
  const userId = "demo-user";
  const links = await db.shortLink.findMany({
    where: { OR: [{ ownerId: userId }, { isPrivate: false }] },
    include: { collections: { include: { collection: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const collections = await db.collection.findMany({
    where: { OR: [{ ownerId: userId }, { isPrivate: false }] },
    orderBy: { name: "asc" },
  });
  return <LinkDashboard userId={userId} initialLinks={links} collections={collections} />;
}
