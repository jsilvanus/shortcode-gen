import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCurrentDomainAdmin, authErrorStatus } from "@/lib/domain-context";

export async function GET() {
  try {
    const { domain } = await requireCurrentDomainAdmin();
    const complaints = await db.linkComplaint.findMany({
      where: { shortLink: { domainId: domain.id } },
      include: { shortLink: { select: { code: true, title: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(complaints);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Authentication required" : "Forbidden" }, { status: authErrorStatus(message, 403) });
  }
}

const resolveSchema = z.object({ id: z.string().min(1) }).strict();

export async function PATCH(request: Request) {
  try {
    const { domain } = await requireCurrentDomainAdmin();
    const parsed = resolveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const result = await db.linkComplaint.updateMany({ where: { id: parsed.data.id, shortLink: { domainId: domain.id } }, data: { resolvedAt: new Date() } });
    if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message === "AUTHENTICATION_REQUIRED" ? "Authentication required" : "Forbidden" }, { status: authErrorStatus(message, 403) });
  }
}
