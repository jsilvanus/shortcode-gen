import { NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/auth/api-keys";
import { authErrorStatus, requireCurrentDomainMembership } from "@/lib/domain-context";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { domain, user } = await requireCurrentDomainMembership();
    const { id } = await params;
    const result = await revokeApiKey(domain.id, user.id, id);
    if (!result.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not revoke API key";
    return NextResponse.json({ error: message }, { status: authErrorStatus(message, 400) });
  }
}
