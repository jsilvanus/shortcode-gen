import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalizeCode } from "@/lib/links/codes";
import { canViewLink } from "@/lib/auth/authorization";
import { getCurrentDomainContext, getRequestOrigin } from "@/lib/domain-context";
import { generateQrCode, type QrFormat } from "@/lib/qr";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getCurrentDomainContext();
  const link = await db.shortLink.findUnique({ where: { domainId_code: { domainId: context.domain.id, code: canonicalizeCode(code) } } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = context.user;
  if (!user || !context.membership || !canViewLink(context.membership.role === "ADMIN" ? "ADMIN" : "USER", link.ownerId, user.id, link.isPrivate)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formatParam = new URL(request.url).searchParams.get("format");
  const format: QrFormat = formatParam === "png" ? "png" : "svg";
  if (formatParam && formatParam !== "svg" && formatParam !== "png") {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  const origin = await getRequestOrigin(context.domain.hostname);
  const shortUrl = `${origin}/${link.code}`;
  const { body, contentType } = await generateQrCode(shortUrl, format);
  return new NextResponse(Buffer.isBuffer(body) ? new Uint8Array(body) : body, { headers: { "content-type": contentType, "cache-control": "private, max-age=3600" } });
}
