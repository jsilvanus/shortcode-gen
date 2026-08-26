import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiKey, listApiKeys } from "@/lib/auth/api-keys";
import { authErrorStatus, requireCurrentDomainMembership } from "@/lib/domain-context";
import { recordAuditEvent } from "@/lib/audit/log";

const createSchema = z.object({
  label: z.string().trim().min(1).max(100),
  expiresAt: z.string().datetime().nullable().optional(),
}).strict();

export async function GET() {
  try {
    const { domain, user } = await requireCurrentDomainMembership();
    return NextResponse.json(await listApiKeys(domain.id, user.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load API keys";
    return NextResponse.json({ error: message }, { status: authErrorStatus(message, 403) });
  }
}

export async function POST(request: Request) {
  try {
    const { domain, user, authMethod, apiKeyId } = await requireCurrentDomainMembership();
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid API key data" }, { status: 400 });
    const { apiKey, token } = await createApiKey({
      domainId: domain.id,
      userId: user.id,
      label: parsed.data.label,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    await recordAuditEvent({ domainId: domain.id, userId: user.id, authMethod, apiKeyId, action: "apikey.create", resourceType: "ApiKey", resourceId: apiKey.id });
    return NextResponse.json({ id: apiKey.id, label: apiKey.label, keyPrefix: apiKey.keyPrefix, createdAt: apiKey.createdAt, expiresAt: apiKey.expiresAt, token }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create API key";
    return NextResponse.json({ error: message }, { status: authErrorStatus(message, 400) });
  }
}
