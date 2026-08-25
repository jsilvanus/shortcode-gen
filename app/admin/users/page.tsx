import { redirect } from "next/navigation";
import { getCurrentDomainContext } from "@/lib/domain-context";
import { DomainContextNav } from "@/components/admin/domain-context-nav";
import { DomainUserManager } from "@/components/admin/domain-user-manager";
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
      <DomainUserManager domainId={context.domain.id} initialUsers={memberships} />
    </main>
  );
}
