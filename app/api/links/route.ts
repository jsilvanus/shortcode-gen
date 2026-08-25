import { NextResponse } from "next/server";
import { createShortLink } from "@/lib/links/service";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json();
  if (typeof body?.targetUrl !== "string") return NextResponse.json({ error: "targetUrl is required" }, { status: 400 });
  try {
    const link = await createShortLink({ ...body, ownerId: user.id });
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create link" }, { status: 400 });
  }
}
