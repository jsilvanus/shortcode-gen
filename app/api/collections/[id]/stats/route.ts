import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentDomainContext } from "@/lib/domain-context";
import { mergeHll, estimateHll, deserializeHll } from "@/lib/analytics/hll";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getCurrentDomainContext();
  const user = context.user;
  if (!user || !context.membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const collection = await db.collection.findUnique({ where: { id }, select: { domainId: true, ownerId: true, isPrivate: true } });
  if (!collection || collection.domainId !== context.domain.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = context.membership.role === "ADMIN";
  const ownerOrAdmin = isAdmin || collection.ownerId === user.id;
  if (!ownerOrAdmin && collection.isPrivate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(to.getTime() - 30 * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const links = await db.linkCollection.findMany({ where: { collectionId: id, shortLink: { domainId: context.domain.id, ...(ownerOrAdmin ? {} : { isPrivate: false }) } }, select: { shortLinkId: true } });
  const ids = links.map(x => x.shortLinkId);
  if (!ids.length) return NextResponse.json({ collectionId: id, from, to, exact: false, linkCount: 0, totals: { pageViews: 0, redirects: 0, uniqueViews: 0, uniqueRedirects: 0 }, daily: [], monthly: [] });
  const [daily, monthly] = await Promise.all([
    db.linkDailyStat.findMany({ where: { shortLinkId: { in: ids }, date: { gte: from, lt: to } } }),
    db.linkMonthlyStat.findMany({ where: { shortLinkId: { in: ids } }, orderBy: [{ year: "asc" }, { month: "asc" }] }),
  ]);
  const totals = daily.reduce((a, d) => ({ pageViews: a.pageViews + d.pageViews, redirects: a.redirects + d.redirects }), { pageViews: 0, redirects: 0 });
  const firstMonth = from.getUTCFullYear() * 100 + from.getUTCMonth() + 1;
  const lastMonth = to.getUTCFullYear() * 100 + to.getUTCMonth() + 1;
  const relevant = monthly.filter(m => { const key = m.year * 100 + m.month; return key >= firstMonth && key <= lastMonth; });
  const uniqueViews = estimateHll(mergeHll(relevant.map(m => deserializeHll(m.uniqueViewsHll))));
  const uniqueRedirects = estimateHll(mergeHll(relevant.map(m => deserializeHll(m.uniqueRedirectsHll))));
  const dailySeries = Object.values(daily.reduce<Record<string, { date: string; pageViews: number; redirects: number }>>((acc, d) => {
    const key = d.date.toISOString().slice(0, 10); const current = acc[key] ?? { date: key, pageViews: 0, redirects: 0 };
    current.pageViews += d.pageViews; current.redirects += d.redirects; acc[key] = current; return acc;
  }, {})).sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ collectionId: id, from, to, exact: false, linkCount: ids.length, totals: { ...totals, uniqueViews, uniqueRedirects }, daily: dailySeries, monthly: relevant.map(m => ({ year: m.year, month: m.month, uniqueViews: estimateHll(deserializeHll(m.uniqueViewsHll)), uniqueRedirects: estimateHll(deserializeHll(m.uniqueRedirectsHll)) })) });
}
