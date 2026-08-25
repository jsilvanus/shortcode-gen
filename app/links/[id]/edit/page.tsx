import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LinkForm } from "@/components/links/link-form";
import { getCurrentDomainContext } from "@/lib/domain-context";
import { canEditLink } from "@/lib/auth/authorization";

export default async function EditLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getCurrentDomainContext();
  if (!context.user || !context.membership) redirect("/admin/login?returnTo=/links");

  const link = await db.shortLink.findFirst({
    where: { id, domainId: context.domain.id },
    include: { collections: true },
  });
  if (!link) notFound();

  const role = context.membership.role === "ADMIN" ? "ADMIN" : "USER";
  if (!canEditLink(role, link.ownerId, context.user.id, link.isPrivate)) redirect("/links");

  const collections = await db.collection.findMany({
    where: {
      domainId: context.domain.id,
      OR: [{ ownerId: context.user.id }, { isPrivate: false }],
    },
    orderBy: { name: "asc" },
  });

  return (
    <main>
      <h1>Edit {link.code}</h1>
      <LinkForm
        userId={context.user.id}
        collections={collections}
        initial={{
          code: link.code,
          targetUrl: link.targetUrl,
          isPrivate: link.isPrivate,
          expiresAt: link.expiresAt?.toISOString() ?? null,
          collectionIds: link.collections.map(x => x.collectionId),
        }}
      />
    </main>
  );
}
