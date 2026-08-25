import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DashboardAnalytics } from "@/components/dashboard/dashboard-analytics";
import { CollectionManager } from "@/components/dashboard/collection-manager";
import { LinkManager } from "@/components/dashboard/link-manager";

export default async function UserDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  const links = await db.shortLink.findMany({
    where: { OR: [{ ownerId: user.id }, { isPrivate: false }] },
    select: { id: true, code: true, title: true, targetUrl: true, description: true, isPrivate: true, active: true, expiresAt: true, ownerId: true, collections: { select: { collectionId: true } } },
    orderBy: { code: "asc" },
  });
  const collections = await db.collection.findMany({
    where: { OR: [{ ownerId: user.id }, { isPrivate: false }] },
    select: { id: true, name: true, description: true, isPrivate: true, ownerId: true },
    orderBy: { name: "asc" },
  });
  const manageableCollections = collections.filter(c => c.ownerId === user.id || user.role === "ADMIN");
  const linkOptions = links.map(l => ({ ...l, expiresAt: l.expiresAt?.toISOString() ?? null, collectionIds: l.collections.map(c => c.collectionId) }));
  return (
    <main>
      <h1>My links</h1>
      <p>Signed in as {user.username}.</p>
      <CollectionManager initial={manageableCollections} />
      <section aria-labelledby="link-management-title" style={{ marginTop: 32 }}>
        <h2 id="link-management-title">Manage links</h2>
        <LinkManager initial={linkOptions.map(l => ({ ...l, canEdit: user.role === "ADMIN" || l.ownerId === user.id || !l.isPrivate }))} collections={manageableCollections} />
      </section>
      <section style={{ marginTop: 32 }} aria-labelledby="analytics-title"><h2 id="analytics-title">Statistics</h2><DashboardAnalytics links={linkOptions} collections={collections} /></section>
      {user.role === "ADMIN" && <p><a href="/admin/dashboard">Administration</a></p>}
    </main>
  );
}
