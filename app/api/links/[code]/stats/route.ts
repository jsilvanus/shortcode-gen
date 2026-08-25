import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalizeCode } from "@/lib/links/codes";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = await db.shortLink.findUnique({ where: { code: canonicalizeCode(code) } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(request.url);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(to.getTime() - 30 * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const daily = await db.linkDailyStat.findMany({ where: { shortLinkId: link.id, date: { gte: from, lt: to } }, orderBy: { date: "asc" } });
  const rawEvents = await db.linkVisit.findMany({ where: { shortLinkId: link.id, createdAt: { gte: from, lt: to } }, select: { eventType: true, visitorHash: true } });
  const uniqueViews = new Set(rawEvents.filter(e => e.eventType === "PAGE_VIEW").map(e => e.visitorHash)).size;
  const uniqueRedirects = new Set(rawEvents.filter(e => e.eventType === "REDIRECT").map(e => e.visitorHash)).size;
  const totals = daily.reduce((a, d) => ({ pageViews: a.pageViews + d.pageViews, redirects: a.redirects + d.redirects }), { pageViews: 0, redirects: 0 });
  return NextResponse.json({ from, to, totals: { ...totals, uniqueViews, uniqueRedirects }, daily });
}
