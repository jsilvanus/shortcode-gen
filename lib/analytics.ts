import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { addHll, decodeHll, emptyHll, encodeHll } from "@/lib/hll";

export type VisitEventType = "PAGE_VIEW" | "REDIRECT";

function visitorHash(ip: string, userAgent: string, year: number): string {
  const secret = process.env.ANALYTICS_HASH_SECRET;
  if (!secret) throw new Error("ANALYTICS_HASH_SECRET is required");
  return createHmac("sha256", secret).update(`${year}\n${ip}\n${userAgent}`).digest("hex");
}

export async function recordVisit(input: { shortLinkId: string; eventType: VisitEventType; ip: string; userAgent: string }) {
  const year = new Date().getUTCFullYear();
  return db.linkVisit.create({ data: { shortLinkId: input.shortLinkId, eventType: input.eventType, visitorHash: visitorHash(input.ip, input.userAgent, year) } });
}

export async function aggregateVisits(endOfDay: Date) {
  const start = new Date(endOfDay); start.setUTCDate(start.getUTCDate() - 1);
  const events = await db.linkVisit.findMany({ where: { createdAt: { gte: start, lt: endOfDay } } });
  const groups = new Map<string, { pageViews: number; redirects: number; views: Set<string>; redirectsUnique: Set<string>; month: number; year: number }>();
  for (const event of events) {
    const date = new Date(event.createdAt); date.setUTCHours(0, 0, 0, 0);
    const key = `${event.shortLinkId}:${date.toISOString()}`;
    const group = groups.get(key) ?? { pageViews: 0, redirects: 0, views: new Set(), redirectsUnique: new Set(), month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
    if (event.eventType === "PAGE_VIEW") { group.pageViews++; group.views.add(event.visitorHash); }
    if (event.eventType === "REDIRECT") { group.redirects++; group.redirectsUnique.add(event.visitorHash); }
    groups.set(key, group);
  }
  for (const [key, group] of groups) {
    const [shortLinkId, dateIso] = key.split(":");
    await db.linkDailyStat.upsert({ where: { shortLinkId_date: { shortLinkId, date: new Date(dateIso) } }, create: { shortLinkId, date: new Date(dateIso), pageViews: group.pageViews, redirects: group.redirects, uniqueViews: group.views.size, uniqueRedirects: group.redirectsUnique.size }, update: { pageViews: group.pageViews, redirects: group.redirects, uniqueViews: group.views.size, uniqueRedirects: group.redirectsUnique.size } });

    const monthStats = await db.linkMonthlyStat.findUnique({ where: { shortLinkId_year_month: { shortLinkId, year: group.year, month: group.month } } });
    const viewHll = monthStats ? decodeHll(monthStats.uniqueViewsHll) : emptyHll();
    const redirectHll = monthStats ? decodeHll(monthStats.uniqueRedirectsHll) : emptyHll();
    for (const hash of group.views) addHll(viewHll, hash);
    for (const hash of group.redirectsUnique) addHll(redirectHll, hash);
    await db.linkMonthlyStat.upsert({ where: { shortLinkId_year_month: { shortLinkId, year: group.year, month: group.month } }, create: { shortLinkId, year: group.year, month: group.month, uniqueViewsHll: encodeHll(viewHll), uniqueRedirectsHll: encodeHll(redirectHll) }, update: { uniqueViewsHll: encodeHll(viewHll), uniqueRedirectsHll: encodeHll(redirectHll) } });
  }
  await db.linkVisit.deleteMany({ where: { createdAt: { lt: new Date(endOfDay.getTime() - 90 * 86400000) } } });
}
