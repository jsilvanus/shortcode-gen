import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authErrorStatus, requireCurrentDomainMembership } from "@/lib/domain-context";

const updateSchema = z.object({ name: z.string().trim().min(1).max(100).optional(), description: z.string().trim().max(500).nullable().optional(), isPrivate: z.boolean().optional() }).refine(v => Object.keys(v).length > 0);

async function accessible(id: string, domainId: string, userId: string, isAdmin: boolean) {
  return db.collection.findFirst({ where: { id, domainId, ...(isAdmin ? {} : { ownerId: userId }) } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { domain, user, membership } = await requireCurrentDomainMembership();
    const { id } = await params;
    const collection = await db.collection.findFirst({ where: { id, domainId: domain.id, ...(membership.role === "ADMIN" ? {} : { OR: [{ ownerId: user.id }, { isPrivate: false }] }) } });
    if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(collection);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load collection";
    return NextResponse.json({ error: message }, { status: authErrorStatus(message, 403) });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { domain, user, membership } = await requireCurrentDomainMembership();
    const { id } = await params;
    const collection = await accessible(id, domain.id, user.id, membership.role === "ADMIN");
    if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
    try {
      return NextResponse.json(await db.collection.update({ where: { id }, data: parsed.data }));
    } catch (error: any) {
      if (error?.code === "P2002") return NextResponse.json({ error: "Collection name already exists" }, { status: 409 });
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update collection";
    return NextResponse.json({ error: message }, { status: authErrorStatus(message, 400) });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { domain, user, membership } = await requireCurrentDomainMembership();
    const { id } = await params;
    const collection = await accessible(id, domain.id, user.id, membership.role === "ADMIN");
    if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.collection.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete collection";
    return NextResponse.json({ error: message }, { status: authErrorStatus(message, 400) });
  }
}
