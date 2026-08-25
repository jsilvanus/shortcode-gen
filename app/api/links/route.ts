import { NextResponse } from "next/server";
import { z } from "zod";
import { createShortLink } from "@/lib/links/service";
import { getCurrentDomainContext } from "@/lib/domain-context";

const createSchema = z.object({
  targetUrl: z.string().trim().min(1).max(2048),
  code: z.string().trim().max(64).optional(),
  isPrivate: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
}).strict();

export async function POST(request: Request) {
  const context = await getCurrentDomainContext();
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
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("link creation failed", error);
    return NextResponse.json({ error: "Could not create link" }, { status: 400 });
  }
}
