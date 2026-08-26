import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveLink } from "@/lib/links/service";
import { getCurrentDomain } from "@/lib/domain-context";
import { getTrustedClientIp } from "@/lib/security/client-ip";
import { recordVisit } from "@/lib/analytics";

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let domain;
  try {
    domain = await getCurrentDomain();
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const link = await getActiveLink(domain.id, code);
  if (!link) return NextResponse.json({ error: "This link is no longer available" }, { status: 404 });
  const requestHeaders = await headers();
  const ip = getTrustedClientIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";
  await recordVisit({ shortLinkId: link.id, eventType: "REDIRECT", ip, userAgent });
  return NextResponse.json({ ok: true });
}
