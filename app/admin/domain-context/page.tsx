import { redirect } from "next/navigation";
import { getCurrentDomainContext } from "@/lib/domain-context";
import { db } from "@/lib/db";
import { DomainContextNav } from "@/components/admin/domain-context-nav";

export default async function DomainContextPage() {
  const context = await getCurrentDomainContext();
  if (!context.user || !context.membership) redirect("/admin/login?returnTo=/admin/domain-context");

  const aliases = await db.domainAlias.findMany({
    where: { domainId: context.domain.id, active: true },
    select: { hostname: true },
    orderBy: { hostname: "asc" },
  });

  return (
    <main>
      <h1>Domain</h1>
      <DomainContextNav hostname={context.domain.hostname} aliases={aliases.map(a => a.hostname)} role={context.membership.role === "ADMIN" ? "ADMIN" : "USER"} />
      <section>
        <h2>{context.domain.name}</h2>
        <p>Canonical hostname: {context.domain.hostname}</p>
        {aliases.length > 0 && (
          <>
            <h3>Aliases</h3>
            <ul>{aliases.map(alias => <li key={alias.hostname}>{alias.hostname}</li>)}</ul>
          </>
        )}
      </section>
    </main>
  );
}
