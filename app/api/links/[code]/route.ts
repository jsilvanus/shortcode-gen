import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalizeCode } from "@/lib/links/codes";
import { canEditLink, canViewLink } from "@/lib/auth/authorization";
import { getCurrentDomainContext } from "@/lib/domain-context";
import { validateExpiry, validateTargetUrl } from "@/lib/links/service";
import { recordAuditEvent } from "@/lib/audit/log";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const context = await getCurrentDomainContext();
  if (context.rateLimited) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  const user = context.user;
  if (!user || !context.membership) return NextResponse.json({ error: "Domain access required" }, { status: user ? 403 : 401 });
  const { code } = await params;
  const link = await db.shortLink.findUnique({ where: { domainId_code: { domainId: context.domain.id, code: canonicalizeCode(code) } } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canViewLink(context.membership.role === "ADMIN" ? "ADMIN" : "USER", link.ownerId, user.id, link.isPrivate)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(link);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const context = await getCurrentDomainContext();
  if (context.rateLimited) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  const user = context.user;
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.membership) return NextResponse.json({ error: "Domain access required" }, { status: 403 });
  const { code } = await params;
  const body = await request.json().catch(() => null);
  const link = await db.shortLink.findUnique({ where: { domainId_code: { domainId: context.domain.id, code: canonicalizeCode(code) } } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = context.membership.role === "ADMIN" ? "ADMIN" : "USER";
  if (!canEditLink(role, link.ownerId, user.id, link.isPrivate)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let targetUrl: string | undefined;
  let expiresAt: Date | null | undefined;
  try {
    if (body?.targetUrl !== undefined) {
      if (typeof body.targetUrl !== "string") throw new Error("Invalid target URL");
      targetUrl = (await validateTargetUrl(body.targetUrl, context.domain.id)).url.toString();
    }
    if (body?.expiresAt !== undefined) {
      if (body.expiresAt !== null && typeof body.expiresAt !== "string") throw new Error("Invalid expiration date");
      expiresAt = body.expiresAt === null ? null : new Date(body.expiresAt);
      const settings = (await validateTargetUrl(link.targetUrl, context.domain.id)).settings;
      validateExpiry(expiresAt, settings);
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid link data" }, { status: 400 });
  }

  const collectionIds = Array.isArray(body?.collectionIds) && body.collectionIds.every((x: unknown) => typeof x === "string") ? [...new Set(body.collectionIds as string[])] : null;
  if (body?.collectionIds !== undefined && !collectionIds) return NextResponse.json({ error: "Invalid collectionIds" }, { status: 400 });
  if (collectionIds) {
    const allowed = await db.collection.findMany({ where: { id: { in: collectionIds }, domainId: context.domain.id, ...(role === "ADMIN" ? {} : { ownerId: user.id }) }, select: { id: true } });
    if (allowed.length !== collectionIds.length) return NextResponse.json({ error: "You can only assign links to collections you manage in this domain" }, { status: 403 });
  }

  const updated = await db.$transaction(async tx => {
    const result = await tx.shortLink.update({ where: { id: link.id }, data: {
      ...(targetUrl !== undefined ? { targetUrl } : {}),
      ...(typeof body?.isPrivate === "boolean" ? { isPrivate: body.isPrivate } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
      ...(typeof body?.title === "string" ? { title: body.title } : {}),
      ...(typeof body?.description === "string" ? { description: body.description } : {}),
      ...(typeof body?.active === "boolean" ? { active: body.active } : {}),
    } });
    if (collectionIds) {
      await tx.linkCollection.deleteMany({ where: { shortLinkId: link.id } });
      if (collectionIds.length) await tx.linkCollection.createMany({ data: collectionIds.map(collectionId => ({ shortLinkId: link.id, collectionId })) });
    }
    return result;
  });
  await recordAuditEvent({ domainId: context.domain.id, userId: user.id, authMethod: context.authMethod, apiKeyId: context.apiKeyId, action: "link.update", resourceType: "ShortLink", resourceId: updated.id });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const context = await getCurrentDomainContext();
  if (context.rateLimited) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  const user = context.user;
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.membership) return NextResponse.json({ error: "Domain access required" }, { status: 403 });
  const { code } = await params;
  const link = await db.shortLink.findUnique({ where: { domainId_code: { domainId: context.domain.id, code: canonicalizeCode(code) } } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = context.membership.role === "ADMIN" ? "ADMIN" : "USER";
  if (!canEditLink(role, link.ownerId, user.id, link.isPrivate)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await db.shortLink.delete({ where: { id: link.id } });
  await recordAuditEvent({ domainId: context.domain.id, userId: user.id, authMethod: context.authMethod, apiKeyId: context.apiKeyId, action: "link.delete", resourceType: "ShortLink", resourceId: link.id });
  return new NextResponse(null, { status: 204 });
}
