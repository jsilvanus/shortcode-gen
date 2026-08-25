import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalizeCode } from "@/lib/links/codes";
import { canEditLink } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { code } = await params;
  const body = await request.json();
  const link = await db.shortLink.findUnique({ where: { code: canonicalizeCode(code) } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditLink(user.role === "ADMIN" ? "ADMIN" : "USER", link.ownerId, user.id, link.isPrivate)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const updated = await db.shortLink.update({ where: { id: link.id }, data: {
    ...(typeof body.targetUrl === "string" ? { targetUrl: body.targetUrl } : {}),
    ...(typeof body.isPrivate === "boolean" ? { isPrivate: body.isPrivate } : {}),
    ...(body.expiresAt === null || typeof body.expiresAt === "string" ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}),
    ...(typeof body.title === "string" ? { title: body.title } : {}),
    ...(typeof body.description === "string" ? { description: body.description } : {}),
  } });
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
