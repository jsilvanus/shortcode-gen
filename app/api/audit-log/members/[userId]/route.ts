import { NextResponse } from "next/server";
import { getMemberAuditLog } from "@/lib/audit/log";
import { authErrorStatus, requireCurrentDomainAdmin } from "@/lib/domain-context";
import { getDomainMembership } from "@/lib/domain";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { domain, user, authMethod, apiKeyId } = await requireCurrentDomainAdmin();
    const { userId: targetUserId } = await params;
    const targetMembership = await getDomainMembership(targetUserId, domain.id);
    if (!targetMembership) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const entries = await getMemberAuditLog(domain.id, { userId: user.id, authMethod, apiKeyId }, targetUserId);
    return NextResponse.json(entries.map(e => ({ action: e.action, resourceType: e.resourceType, resourceId: e.resourceId, authMethod: e.authMethod, createdAt: e.createdAt })));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load member activity";
    return NextResponse.json({ error: message }, { status: authErrorStatus(message, 403) });
  }
}
