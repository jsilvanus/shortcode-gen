import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

const updateSchema = z.object({ name: z.string().trim().min(1).max(100).optional(), description: z.string().trim().max(500).nullable().optional(), isPrivate: z.boolean().optional() }).refine(v => Object.keys(v).length > 0);

async function owned(id: string, user: { id: string; role: string }) {
  return db.collection.findFirst({ where: { id, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params; const collection = await owned(id, user); if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
  try { return NextResponse.json(await db.collection.update({ where: { id }, data: parsed.data })); }
  catch (error: any) { if (error?.code === "P2002") return NextResponse.json({ error: "Collection name already exists" }, { status: 409 }); throw error; }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params; const collection = await owned(id, user); if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.collection.delete({ where: { id } }); return new NextResponse(null, { status: 204 });
}
