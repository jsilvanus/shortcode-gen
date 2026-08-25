import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { normalizeHostname } from "@/lib/domain";

async function requireSystemAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  if (user.role !== "ADMIN") return { error: NextResponse.json({ error: "System administrator access required" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const auth = await requireSystemAdmin();
  if (auth.error) return auth.error;
  const domains = await db.domain.findMany({
    include: { aliases: true, _count: { select: { links: true, memberships: true } } },
    orderBy: { hostname: "asc" },
  });
  return NextResponse.json({ domains });
}

export async function POST(request: Request) {
  const auth = await requireSystemAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (typeof body.hostname !== "string" || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "hostname and name are required" }, { status: 400 });
    }
    const hostname = normalizeHostname(body.hostname);
    const domain = await db.domain.create({
      data: { hostname, name: body.name.trim(), createdById: auth.user.id },
    });
    return NextResponse.json({ domain }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid hostname") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create domain" }, { status: 409 });
  }
}
