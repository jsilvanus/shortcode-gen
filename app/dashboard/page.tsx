import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DashboardAnalytics } from "@/components/dashboard/dashboard-analytics";
import { CollectionManager } from "@/components/dashboard/collection-manager";

export default async function UserDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  const links = await db.shortLink.findMany({
    where: { OR: [{ ownerId: user.id }, { isPrivate: false }] },
    select: { id: true, code: true, title: true, targetUrl: true, isPrivate: true, active: true, expiresAt: true, collections: { select: { collectionId: true } } },
    orderBy: { code: "asc" },
  });
  const collections = await db.collection.findMany({
    where: { OR: [{ ownerId: user.id }, { isPrivate: false }] },
    select: { id: true, name: true, description: true, isPrivate: true, ownerId: true },
    orderBy: { name: "asc" },
  });
  const manageableCollections = collections.filter(c => c.ownerId === user.id || user.role === "ADMIN");
  return (
    <main>
      <h1>My links</h1>
      <p>Signed in as {user.username}.</p>
      <CollectionManager initial={manageableCollections} />
      <DashboardAnalytics links={links.map(l => ({ ...l, expiresAt: l.expiresAt?.toISOString() ?? null, collectionIds: l.collections.map(c => c.collectionId) }))} collections={collections} />
      {user.role === "ADMIN" && <p><a href="/admin/dashboard">Administration</a></p>}
    </main>
  );
}
