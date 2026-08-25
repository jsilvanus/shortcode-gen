import { NextResponse } from "next/server";
import { createCollection, listCollections } from "@/lib/collections/service";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  return NextResponse.json(await listCollections(user.id));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json();
  if (typeof body?.name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });
  try { return NextResponse.json(await createCollection({ ...body, ownerId: user.id }), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create collection" }, { status: 400 }); }
}
