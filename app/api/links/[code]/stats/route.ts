import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalizeCode } from "@/lib/links/codes";
import { getCurrentDomainContext } from "@/lib/domain-context";
import { canViewLink } from "@/lib/auth/authorization";
import { estimateHll, mergeHll, decodeHll } from "@/lib/hll";
import { suppressSmallCount } from "@/lib/analytics";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getCurrentDomainContext();
  if (context.rateLimited) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  const link = await db.shortLink.findUnique({ where: { domainId_code: { domainId: context.domain.id, code: canonicalizeCode(code) } } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = context.user;
  if (!user || !context.membership || !canViewLink(context.membership.role === "ADMIN" ? "ADMIN" : "USER", link.ownerId, user.id, link.isPrivate)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(to.getTime() - 30 * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const daily = await db.linkDailyStat.findMany({ where: { shortLinkId: link.id, date: { gte: from, lt: to } }, orderBy: { date: "asc" } });
  const rawEvents = await db.linkVisit.findMany({ where: { shortLinkId: link.id, createdAt: { gte: from, lt: to } }, select: { eventType: true, visitorHash: true } });
  const exactViews = new Set(rawEvents.filter(e => e.eventType === "PAGE_VIEW").map(e => e.visitorHash)).size;
  const exactRedirects = new Set(rawEvents.filter(e => e.eventType === "REDIRECT").map(e => e.visitorHash)).size;
  const monthly = await db.linkMonthlyStat.findMany({ where: { shortLinkId: link.id }, orderBy: [{ year: "asc" }, { month: "asc" }] });
  const hllViews = mergeHll(monthly.filter(m => m.year * 100 + m.month >= from.getUTCFullYear() * 100 + (from.getUTCMonth() + 1) && m.year * 100 + m.month <= to.getUTCFullYear() * 100 + (to.getUTCMonth() + 1)).map(m => decodeHll(m.uniqueViewsHll)));
  const hllRedirects = mergeHll(monthly.filter(m => m.year * 100 + m.month >= from.getUTCFullYear() * 100 + (from.getUTCMonth() + 1) && m.year * 100 + m.month <= to.getUTCFullYear() * 100 + (to.getUTCMonth() + 1)).map(m => decodeHll(m.uniqueRedirectsHll)));
  const fullyRaw = to.getTime() <= Date.now() && from.getTime() >= Date.now() - 90 * 86400000;
  const totals = daily.reduce((a, d) => ({ pageViews: a.pageViews + d.pageViews, redirects: a.redirects + d.redirects }), { pageViews: 0, redirects: 0 });
  const uniqueViews = fullyRaw ? exactViews : estimateHll(hllViews);
  const uniqueRedirects = fullyRaw ? exactRedirects : estimateHll(hllRedirects);
  return NextResponse.json({
    from, to, exact: fullyRaw,
    totals: { pageViews: suppressSmallCount(totals.pageViews), redirects: suppressSmallCount(totals.redirects), uniqueViews: suppressSmallCount(uniqueViews), uniqueRedirects: suppressSmallCount(uniqueRedirects) },
    daily: daily.map(d => ({ date: d.date, pageViews: suppressSmallCount(d.pageViews), redirects: suppressSmallCount(d.redirects), uniqueViews: suppressSmallCount(d.uniqueViews), uniqueRedirects: suppressSmallCount(d.uniqueRedirects) })),
    monthly: monthly.map(m => ({ year: m.year, month: m.month, uniqueViews: suppressSmallCount(estimateHll(decodeHll(m.uniqueViewsHll))), uniqueRedirects: suppressSmallCount(estimateHll(decodeHll(m.uniqueRedirectsHll))) })),
  });
}
