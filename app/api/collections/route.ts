import { NextResponse } from "next/server";
import { createCollection, listCollections } from "@/lib/collections/service";
import { authErrorStatus, requireCurrentDomainMembership } from "@/lib/domain-context";
import { recordAuditEvent } from "@/lib/audit/log";

export async function GET() {
  try {
    const { domain, user } = await requireCurrentDomainMembership();
    return NextResponse.json(await listCollections(domain.id, user.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load collections";
    return NextResponse.json({ error: message }, { status: authErrorStatus(message, 403) });
  }
}

export async function POST(request: Request) {
  try {
    const { domain, user, authMethod, apiKeyId } = await requireCurrentDomainMembership();
    const body = await request.json();
    if (typeof body?.name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });
    const collection = await createCollection({ ...body, domainId: domain.id, ownerId: user.id });
    await recordAuditEvent({ domainId: domain.id, userId: user.id, authMethod, apiKeyId, action: "collection.create", resourceType: "Collection", resourceId: collection.id });
    return NextResponse.json(collection, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create collection";
    return NextResponse.json({ error: message }, { status: authErrorStatus(message, 400) });
  }
}
