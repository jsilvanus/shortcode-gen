import { redirect } from "next/navigation";
import { getCurrentDomainContext } from "@/lib/domain-context";
import { DomainContextNav } from "@/components/admin/domain-context-nav";
import { AliasManager } from "@/components/admin/alias-manager";
import { db } from "@/lib/db";

export default async function DomainAliasesPage() {
  const context = await getCurrentDomainContext();
  if (!context.user || !context.membership) redirect("/admin/login?returnTo=/admin/aliases");
  if (context.membership.role !== "ADMIN") redirect("/links");
  const aliases = await db.domainAlias.findMany({ where: { domainId: context.domain.id }, orderBy: { hostname: "asc" } });
  return (
    <main>
      <DomainContextNav hostname={context.domain.hostname} aliases={aliases.filter(a => a.active).map(a => a.hostname)} role="ADMIN" />
      <h1>Aliases</h1>
      <p>All aliases below point to the same domain, links, users and settings.</p>
      <AliasManager domainId={context.domain.id} initialAliases={aliases} />
    </main>
  );
}
