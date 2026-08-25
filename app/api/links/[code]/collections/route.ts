import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalizeCode } from "@/lib/links/codes";
import { canEditLink } from "@/lib/auth/authorization";
import { setLinkCollections } from "@/lib/collections/service";
import { getCurrentUser } from "@/lib/auth/session";

export async function PUT(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { code } = await params;
  const body = await request.json();
  const link = await db.shortLink.findUnique({ where: { code: canonicalizeCode(code) } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = user.role === "ADMIN" ? "ADMIN" : "USER";
  if (!canEditLink(role, link.ownerId, user.id, link.isPrivate)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!Array.isArray(body.collectionIds) || body.collectionIds.some((id: unknown) => typeof id !== "string")) return NextResponse.json({ error: "collectionIds must be an array" }, { status: 400 });
  const collectionIds = [...new Set(body.collectionIds as string[])];
  const collections = await db.collection.findMany({ where: { id: { in: collectionIds } } });
  if (collections.length !== collectionIds.length) return NextResponse.json({ error: "Unknown collection" }, { status: 400 });
  if (role !== "ADMIN" && collections.some(c => c.isPrivate && c.ownerId !== user.id)) return NextResponse.json({ error: "Cannot use another user's private collection" }, { status: 403 });
  return NextResponse.json(await setLinkCollections(link.id, collectionIds));
}
