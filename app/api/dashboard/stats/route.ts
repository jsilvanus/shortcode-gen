import { NextResponse } from "next/server";
import { getCurrentDomainContext } from "@/lib/domain-context";
import { db } from "@/lib/db";
import { canViewLink } from "@/lib/auth/authorization";
import { estimateHll, mergeHll, deserializeHll } from "@/lib/analytics/hll";

export async function GET(request: Request) {
  const context = await getCurrentDomainContext();
  const user = context.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isSystemAdmin = user.role === "ADMIN";
  if (!isSystemAdmin && !context.membership) return NextResponse.json({ error: "Domain access required" }, { status: 403 });
  const url = new URL(request.url);
  const ids = [...new Set((url.searchParams.get("ids") ?? "").split(",").filter(Boolean))];
  if (!ids.length || ids.length > 100) return NextResponse.json({ error: "Select between 1 and 100 links" }, { status: 400 });
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(to.getTime() - 30 * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const role = isSystemAdmin || context.membership?.role === "ADMIN" ? "ADMIN" : "USER";
  const links = await db.shortLink.findMany({ where: { domainId: context.domain.id, id: { in: ids } }, select: { id: true, ownerId: true, isPrivate: true } });
  if (links.length !== ids.length || links.some(l => !canViewLink(role, l.ownerId, user.id, l.isPrivate))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const linkIds = links.map(l => l.id);
  const daily = await db.linkDailyStat.findMany({ where: { shortLinkId: { in: linkIds }, date: { gte: from, lt: to } }, orderBy: { date: "asc" } });
  const monthly = await db.linkMonthlyStat.findMany({ where: { shortLinkId: { in: linkIds } } });
  const dailyMap = new Map<string, { pageViews: number; redirects: number }>();
  for (const d of daily) { const v = dailyMap.get(d.date.toISOString()) ?? { pageViews: 0, redirects: 0 }; v.pageViews += d.pageViews; v.redirects += d.redirects; dailyMap.set(d.date.toISOString(), v); }
  const firstMonth = from.getUTCFullYear() * 12 + from.getUTCMonth();
  const lastMonth = to.getUTCFullYear() * 12 + to.getUTCMonth();
  const relevant = monthly.filter(m => { const n = m.year * 12 + (m.month - 1); return n >= firstMonth && n <= lastMonth; });
  const viewsHll = mergeHll(relevant.map(m => deserializeHll(m.uniqueViewsHll)));
  const redirectsHll = mergeHll(relevant.map(m => deserializeHll(m.uniqueRedirectsHll)));
  const rawWindow = from.getTime() >= Date.now() - 90 * 86400000 && to.getTime() <= Date.now();
  return NextResponse.json({ from, to, exact: rawWindow, totals: { pageViews: daily.reduce((n, d) => n + d.pageViews, 0), redirects: daily.reduce((n, d) => n + d.redirects, 0), uniqueViews: estimateHll(viewsHll), uniqueRedirects: estimateHll(redirectsHll) }, daily: [...dailyMap.entries()].map(([date, value]) => ({ date, ...value })) });
}
