import { redirect } from "next/navigation";
import { getCurrentDomainContext } from "@/lib/domain-context";
import { DomainContextNav } from "@/components/admin/domain-context-nav";
import { db } from "@/lib/db";

export default async function DomainUsersPage() {
  const context = await getCurrentDomainContext();
  if (!context.user || !context.membership) redirect("/admin/login?returnTo=/admin/users");
  if (context.membership.role !== "ADMIN") redirect("/links");
  const [aliases, memberships] = await Promise.all([
    db.domainAlias.findMany({ where: { domainId: context.domain.id, active: true }, select: { hostname: true } }),
    db.domainMembership.findMany({ where: { domainId: context.domain.id }, include: { user: { select: { id: true, email: true, name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <main>
      <DomainContextNav hostname={context.domain.hostname} aliases={aliases.map(a => a.hostname)} role="ADMIN" />
      <h1>Users</h1>
      <p>Users with access to {context.domain.hostname}.</p>
      <table><thead><tr><th>User</th><th>Role</th></tr></thead><tbody>
        {memberships.map(m => <tr key={m.user.id}><td>{m.user.name || m.user.email}</td><td>{m.role}</td></tr>)}
      </tbody></table>
    </main>
  );
}
