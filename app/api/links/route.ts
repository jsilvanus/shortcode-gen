import { NextResponse } from "next/server";
import { z } from "zod";
import { createShortLink } from "@/lib/links/service";
import { getCurrentUser } from "@/lib/auth/session";

const createSchema = z.object({
  targetUrl: z.string().trim().min(1).max(2048),
  code: z.string().trim().max(64).optional(),
  isPrivate: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
}).strict();

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid link data" }, { status: 400 });
  try {
    const link = await createShortLink({ ...parsed.data, expiresAt: parsed.data.expiresAt === undefined ? undefined : parsed.data.expiresAt === null ? null : new Date(parsed.data.expiresAt), ownerId: user.id });
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("link creation failed", error);
    return NextResponse.json({ error: "Could not create link" }, { status: 400 });
  }
}
