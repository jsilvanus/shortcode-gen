import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function UserDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");

  return (
    <main>
      <h1>My links</h1>
      <p>Signed in as {user.username}.</p>
      <p>Your links and non-private links shared by other users will appear here.</p>
      {user.role === "ADMIN" && <p><a href="/admin/dashboard">Administration</a></p>}
    </main>
  );
}
