import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageDomain, createDomainAlias, deleteDomainAlias, listDomainAliases } from "@/lib/domain";

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

  return NextResponse.json({ aliases: await listDomainAliases(domainId) });
}

export async function POST(
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
    if (typeof body.hostname !== "string") {
      return NextResponse.json({ error: "hostname is required" }, { status: 400 });
    }
    const alias = await createDomainAlias(domainId, body.hostname);
    return NextResponse.json({ alias }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid hostname") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Hostname is already a canonical domain") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create alias" }, { status: 409 });
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
  if (typeof body.aliasId !== "string") {
    return NextResponse.json({ error: "aliasId is required" }, { status: 400 });
  }

  const result = await deleteDomainAlias(domainId, body.aliasId);
  if (result.count === 0) return NextResponse.json({ error: "Alias not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
