import { redirect } from "next/navigation";
import { requireCurrentDomainMembership } from "@/lib/domain-context";

export default async function AdminDashboardPage() {
  let context;
  try {
    context = await requireCurrentDomainMembership();
  } catch {
    redirect("/admin/login");
  }

  const isAdmin = context.membership.role === "ADMIN";

  return (
    <main>
      <h1>Administration</h1>
      <p>Signed in as {context.user.username}.</p>
      <p>Domain: {context.domain.hostname}</p>
      <nav>
        <a href="/dashboard">User dashboard</a>
        {isAdmin && <>{" · "}<a href="/admin/settings">Domain settings</a></>}
      </nav>
    </main>
  );
}
