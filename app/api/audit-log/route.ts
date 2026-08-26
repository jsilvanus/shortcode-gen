import { NextResponse } from "next/server";
import { getOwnAuditLog } from "@/lib/audit/log";
import { authErrorStatus, requireCurrentDomainMembership } from "@/lib/domain-context";

export async function GET() {
  try {
    const { domain, user } = await requireCurrentDomainMembership();
    const entries = await getOwnAuditLog(user.id, domain.id);
    return NextResponse.json(entries.map(e => ({ action: e.action, resourceType: e.resourceType, resourceId: e.resourceId, authMethod: e.authMethod, apiKeyLabel: e.apiKeyLabel, createdAt: e.createdAt })));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load activity log";
    return NextResponse.json({ error: message }, { status: authErrorStatus(message, 403) });
  }
}
