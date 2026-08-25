import { redirect } from "next/navigation";
import { getCurrentDomainContext } from "@/lib/domain-context";
import { db } from "@/lib/db";
import { DomainContextNav } from "@/components/admin/domain-context-nav";

export default async function DomainPage() {
  const context = await getCurrentDomainContext();
  if (!context.user || !context.membership) redirect("/admin/login?returnTo=/admin/domain");
  if (context.membership.role !== "ADMIN") redirect("/links");

  const [aliases, memberships] = await Promise.all([
    db.domainAlias.findMany({ where: { domainId: context.domain.id, active: true }, select: { hostname: true }, orderBy: { hostname: "asc" } }),
    db.domainMembership.findMany({ where: { domainId: context.domain.id }, include: { user: { select: { id: true, email: true, name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <main>
      <DomainContextNav hostname={context.domain.hostname} aliases={aliases.map(a => a.hostname)} role="ADMIN" />
      <h1>{context.domain.name}</h1>
      <p>Canonical hostname: {context.domain.hostname}</p>
      <h2>Users</h2>
      <ul>{memberships.map(m => <li key={m.user.id}>{m.user.name || m.user.email} — {m.role}</li>)}</ul>
      <h2>Aliases</h2>
      {aliases.length ? <ul>{aliases.map(a => <li key={a.hostname}>{a.hostname}</li>)}</ul> : <p>No aliases configured.</p>}
    </main>
  );
}
