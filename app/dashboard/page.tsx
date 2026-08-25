import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DashboardAnalytics } from "@/components/dashboard/dashboard-analytics";

export default async function UserDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  const links = await db.shortLink.findMany({
    where: { OR: [{ ownerId: user.id }, { isPrivate: false }] },
    select: { id: true, code: true, title: true },
    orderBy: { code: "asc" },
  });
  return (
    <main>
      <h1>My links</h1>
      <p>Signed in as {user.username}.</p>
      <DashboardAnalytics links={links} />
      {user.role === "ADMIN" && <p><a href="/admin/dashboard">Administration</a></p>}
    </main>
  );
}
