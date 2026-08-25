import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalizeCode } from "@/lib/links/codes";
import { canEditLink } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { code } = await params;
  const body = await request.json().catch(() => null);
  const link = await db.shortLink.findUnique({ where: { code: canonicalizeCode(code) } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditLink(user.role === "ADMIN" ? "ADMIN" : "USER", link.ownerId, user.id, link.isPrivate)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const collectionIds = Array.isArray(body?.collectionIds) && body.collectionIds.every((x: unknown) => typeof x === "string") ? [...new Set(body.collectionIds as string[])] : null;
  if (collectionIds) {
    const allowed = await db.collection.findMany({ where: { id: { in: collectionIds }, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) }, select: { id: true } });
    if (allowed.length !== collectionIds.length) return NextResponse.json({ error: "You can only assign links to collections you manage" }, { status: 403 });
  }

  const updated = await db.$transaction(async tx => {
    const result = await tx.shortLink.update({ where: { id: link.id }, data: {
      ...(typeof body?.targetUrl === "string" ? { targetUrl: body.targetUrl } : {}),
      ...(typeof body?.isPrivate === "boolean" ? { isPrivate: body.isPrivate } : {}),
      ...(body?.expiresAt === null || typeof body?.expiresAt === "string" ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}),
      ...(typeof body?.title === "string" ? { title: body.title } : {}),
      ...(typeof body?.description === "string" ? { description: body.description } : {}),
      ...(typeof body?.active === "boolean" ? { active: body.active } : {}),
    } });
    if (collectionIds) {
      await tx.linkCollection.deleteMany({ where: { shortLinkId: link.id } });
      if (collectionIds.length) await tx.linkCollection.createMany({ data: collectionIds.map(collectionId => ({ shortLinkId: link.id, collectionId })), skipDuplicates: true });
    }
    return result;
  });
  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { code } = await params;
  const link = await db.shortLink.findUnique({ where: { code: canonicalizeCode(code) } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditLink(user.role === "ADMIN" ? "ADMIN" : "USER", link.ownerId, user.id, link.isPrivate)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await db.shortLink.delete({ where: { id: link.id } });
  return new NextResponse(null, { status: 204 });
}
