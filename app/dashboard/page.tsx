import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DashboardAnalytics } from "@/components/dashboard/dashboard-analytics";

export default async function UserDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  const links = await db.shortLink.findMany({
    where: { OR: [{ ownerId: user.id }, { isPrivate: false }] },
    select: { id: true, code: true, title: true, isPrivate: true, active: true, expiresAt: true, collections: { select: { collectionId: true } } },
    orderBy: { code: "asc" },
  });
  const collections = await db.collection.findMany({
    where: { OR: [{ ownerId: user.id }, { isPrivate: false }] },
    select: { id: true, name: true, isPrivate: true },
    orderBy: { name: "asc" },
  });
  return (
    <main>
      <h1>My links</h1>
      <p>Signed in as {user.username}.</p>
      <DashboardAnalytics links={links.map(l => ({ ...l, expiresAt: l.expiresAt?.toISOString() ?? null, collectionIds: l.collections.map(c => c.collectionId) }))} collections={collections} />
      {user.role === "ADMIN" && <p><a href="/admin/dashboard">Administration</a></p>}
    </main>
  );
}
