import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LinkForm } from "@/components/links/link-form";

export default async function EditLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TODO: replace placeholder with server session and enforce canEditLink here.
  const userId = "demo-user";
  const link = await db.shortLink.findUnique({ where: { id }, include: { collections: true } });
  if (!link) notFound();
  if (link.isPrivate && link.ownerId !== userId) redirect("/links");
  const collections = await db.collection.findMany({ where: { OR: [{ ownerId: userId }, { isPrivate: false }] }, orderBy: { name: "asc" } });
  return <main><h1>Edit {link.code}</h1><LinkForm userId={userId} collections={collections} initial={{ code: link.code, targetUrl: link.targetUrl, isPrivate: link.isPrivate, expiresAt: link.expiresAt?.toISOString() ?? null, collectionIds: link.collections.map(x => x.collectionId) }} /></main>;
}
