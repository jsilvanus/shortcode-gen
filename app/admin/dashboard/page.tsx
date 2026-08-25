import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Signed in as {user.username} ({user.role}).</p>
      {user.role === "ADMIN" && <p><a href="/admin/settings">Site settings</a></p>}
    </main>
  );
}
