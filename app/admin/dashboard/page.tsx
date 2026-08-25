import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  return (
    <main>
      <h1>Administration</h1>
      <p>Signed in as {user.username}.</p>
      <nav>
        <a href="/dashboard">User dashboard</a>{" · "}
        <a href="/admin/settings">Site settings</a>
      </nav>
    </main>
  );
}
