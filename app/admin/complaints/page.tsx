import { redirect } from "next/navigation";
import { getCurrentDomainContext } from "@/lib/domain-context";
import { db } from "@/lib/db";
import { DomainContextNav } from "@/components/admin/domain-context-nav";
import { ComplaintManager } from "@/components/admin/complaint-manager";

export default async function ComplaintsPage() {
  const context = await getCurrentDomainContext();
  if (!context.user || !context.membership) redirect("/admin/login?returnTo=/admin/complaints");
  if (context.membership.role !== "ADMIN") redirect("/links");

  const complaints = await db.linkComplaint.findMany({
    where: { shortLink: { domainId: context.domain.id } },
    include: { shortLink: { select: { code: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main>
      <DomainContextNav hostname={context.domain.hostname} aliases={[]} role="ADMIN" />
      <h1>Reported links</h1>
      <ComplaintManager initial={complaints.map(c => ({ ...c, createdAt: c.createdAt.toISOString(), resolvedAt: c.resolvedAt?.toISOString() ?? null }))} />
    </main>
  );
}
