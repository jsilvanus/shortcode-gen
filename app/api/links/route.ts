import { NextResponse } from "next/server";
import { createShortLink } from "@/lib/links/service";

export async function POST(request: Request) {
  const body = await request.json();
  if (typeof body?.targetUrl !== "string" || typeof body?.ownerId !== "string") {
    return NextResponse.json({ error: "targetUrl and ownerId are required" }, { status: 400 });
  }
  try {
    const link = await createShortLink(body);
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create link" }, { status: 400 });
  }
}
