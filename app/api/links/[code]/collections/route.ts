import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalizeCode } from "@/lib/links/codes";
import { canEditLink } from "@/lib/auth/authorization";
import { setLinkCollections } from "@/lib/collections/service";

export async function PUT(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await request.json();
  const link = await db.shortLink.findUnique({ where: { code: canonicalizeCode(code) } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const userId = typeof body.userId === "string" ? body.userId : "";
  const role = body.role === "ADMIN" ? "ADMIN" : "USER";
  if (!canEditLink(role, link.ownerId, userId, link.isPrivate)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!Array.isArray(body.collectionIds) || body.collectionIds.some((id: unknown) => typeof id !== "string")) return NextResponse.json({ error: "collectionIds must be an array" }, { status: 400 });

  const collections = await db.collection.findMany({ where: { id: { in: body.collectionIds } } });
  if (collections.length !== new Set(body.collectionIds).size) return NextResponse.json({ error: "Unknown collection" }, { status: 400 });
  if (role !== "ADMIN" && collections.some(c => c.isPrivate && c.ownerId !== userId)) return NextResponse.json({ error: "Cannot use another user's private collection" }, { status: 403 });

  return NextResponse.json(await setLinkCollections(link.id, body.collectionIds));
}
