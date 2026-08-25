import { NextResponse } from "next/server";
import { createCollection, listCollections } from "@/lib/collections/service";

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  return NextResponse.json(await listCollections(userId));
}

export async function POST(request: Request) {
  const body = await request.json();
  if (typeof body?.ownerId !== "string" || typeof body?.name !== "string") return NextResponse.json({ error: "ownerId and name are required" }, { status: 400 });
  try { return NextResponse.json(await createCollection(body), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create collection" }, { status: 400 }); }
}
