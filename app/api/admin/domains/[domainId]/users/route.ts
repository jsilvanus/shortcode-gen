import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageDomain, listDomainMembers, upsertDomainMember, removeDomainMember } from "@/lib/domain";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { domainId } = await params;
  if (!(await canManageDomain(user.id, domainId))) {
    return NextResponse.json({ error: "Domain administrator access required" }, { status: 403 });
  }
  return NextResponse.json({ users: await listDomainMembers(domainId) });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { domainId } = await params;
  if (!(await canManageDomain(user.id, domainId))) {
    return NextResponse.json({ error: "Domain administrator access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (typeof body.userId !== "string" || !["USER", "ADMIN"].includes(body.role)) {
      return NextResponse.json({ error: "userId and role (USER or ADMIN) are required" }, { status: 400 });
    }
    const member = await upsertDomainMember(domainId, body.userId, body.role);
    return NextResponse.json({ user: member });
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to update domain membership" }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { domainId } = await params;
  if (!(await canManageDomain(user.id, domainId))) {
    return NextResponse.json({ error: "Domain administrator access required" }, { status: 403 });
  }

  const body = await request.json();
  if (typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  const result = await removeDomainMember(domainId, body.userId);
  if (result.count === 0) return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
