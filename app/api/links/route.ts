import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createShortLink } from "@/lib/links/service";
import { getCurrentDomainContext } from "@/lib/domain-context";
import { recordAuditEvent } from "@/lib/audit/log";

const createSchema = z.object({
  targetUrl: z.string().trim().min(1).max(2048),
  code: z.string().trim().max(64).optional(),
  isPrivate: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
}).strict();

export async function GET(request: Request) {
  const context = await getCurrentDomainContext();
  if (context.rateLimited) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.membership) return NextResponse.json({ error: "Domain access required" }, { status: 403 });

  const url = new URL(request.url);
  const take = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
  const cursor = url.searchParams.get("cursor");
  const isAdmin = context.membership.role === "ADMIN";
  const links = await db.shortLink.findMany({
    where: { domainId: context.domain.id, ...(isAdmin ? {} : { OR: [{ ownerId: context.user.id }, { isPrivate: false }] }) },
    orderBy: { id: "asc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = links.length > take;
  const page = hasMore ? links.slice(0, take) : links;
  return NextResponse.json({ links: page, nextCursor: hasMore ? page[page.length - 1].id : null });
}

export async function POST(request: Request) {
  const context = await getCurrentDomainContext();
  if (context.rateLimited) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  if (!context.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.membership) return NextResponse.json({ error: "Domain access required" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid link data" }, { status: 400 });

  try {
    const link = await createShortLink({
      ...parsed.data,
      expiresAt: parsed.data.expiresAt === undefined ? undefined : parsed.data.expiresAt === null ? null : new Date(parsed.data.expiresAt),
      ownerId: context.user.id,
      domainId: context.domain.id,
    });
    await recordAuditEvent({ domainId: context.domain.id, userId: context.user.id, authMethod: context.authMethod, apiKeyId: context.apiKeyId, action: "link.create", resourceType: "ShortLink", resourceId: link.id });
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("link creation failed", error);
    return NextResponse.json({ error: "Could not create link" }, { status: 400 });
  }
}
