import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { LinkDashboard } from "@/components/links/link-dashboard";
import { getCurrentUser } from "@/lib/auth/session";

export default async function LinksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login?returnTo=/links");
  const links = await db.shortLink.findMany({
    where: { OR: [{ ownerId: user.id }, { isPrivate: false }] },
    include: { collections: { include: { collection: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const collections = await db.collection.findMany({ where: { OR: [{ ownerId: user.id }, { isPrivate: false }] }, orderBy: { name: "asc" } });
  return <LinkDashboard initialLinks={links} collections={collections} />;
}
