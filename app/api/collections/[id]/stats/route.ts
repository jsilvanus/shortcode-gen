import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collection = await db.collection.findUnique({ where: { id }, include: { links: { select: { shortLinkId: true } } } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(request.url);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(to.getTime() - 30 * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const ids = collection.links.map(l => l.shortLinkId);
  const daily = ids.length ? await db.linkDailyStat.findMany({ where: { shortLinkId: { in: ids }, date: { gte: from, lt: to } }, orderBy: { date: "asc" } }) : [];
  const rawEvents = ids.length ? await db.linkVisit.findMany({ where: { shortLinkId: { in: ids }, createdAt: { gte: from, lt: to } }, select: { eventType: true, visitorHash: true, createdAt: true } }) : [];
  const uniqueViews = new Set(rawEvents.filter(e => e.eventType === "PAGE_VIEW").map(e => e.visitorHash)).size;
  const uniqueRedirects = new Set(rawEvents.filter(e => e.eventType === "REDIRECT").map(e => e.visitorHash)).size;
  const totals = daily.reduce((a, d) => ({ pageViews: a.pageViews + d.pageViews, redirects: a.redirects + d.redirects }), { pageViews: 0, redirects: 0 });
  const byDate = new Map<string, { pageViews: number; redirects: number }>();
  for (const d of daily) { const key = d.date.toISOString(); const x = byDate.get(key) ?? { pageViews: 0, redirects: 0 }; x.pageViews += d.pageViews; x.redirects += d.redirects; byDate.set(key, x); }
  return NextResponse.json({ from, to, linkCount: ids.length, totals: { ...totals, uniqueViews, uniqueRedirects }, daily: [...byDate.entries()].map(([date, value]) => ({ date, ...value })) });
}
