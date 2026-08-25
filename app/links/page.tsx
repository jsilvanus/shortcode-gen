import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { LinkDashboard } from "@/components/links/link-dashboard";
import { getCurrentDomainContext } from "@/lib/domain-context";

export default async function LinksPage() {
  const context = await getCurrentDomainContext();
  if (!context.user) redirect("/admin/login?returnTo=/links");
  if (!context.membership) redirect("/admin/login?returnTo=/links");
  const role = context.membership.role === "ADMIN" ? "ADMIN" : "USER";
  const links = await db.shortLink.findMany({
    where: { domainId: context.domain.id, OR: [{ ownerId: context.user.id }, { isPrivate: false }] },
    include: { collections: { include: { collection: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const collections = await db.collection.findMany({ where: { OR: [{ ownerId: context.user.id }, { isPrivate: false }] }, orderBy: { name: "asc" } });
  return <LinkDashboard initialLinks={links} collections={collections} />;
}
