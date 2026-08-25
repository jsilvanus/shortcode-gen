import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalizeCode } from "@/lib/links/codes";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = await db.shortLink.findUnique({ where: { code: canonicalizeCode(code) } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // TODO: enforce dashboard authorization from the server session.
  const daily = await db.linkDailyStat.findMany({ where: { shortLinkId: link.id }, orderBy: { date: "asc" } });
  const totals = daily.reduce((a, d) => ({ pageViews: a.pageViews + d.pageViews, redirects: a.redirects + d.redirects, uniqueViews: a.uniqueViews + d.uniqueViews, uniqueRedirects: a.uniqueRedirects + d.uniqueRedirects }), { pageViews: 0, redirects: 0, uniqueViews: 0, uniqueRedirects: 0 });
  return NextResponse.json({ totals, daily });
}
