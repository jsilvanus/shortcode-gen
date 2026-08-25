import { createHash, createHmac } from "node:crypto";
import { db } from "@/lib/db";

export type VisitEventType = "PAGE_VIEW" | "REDIRECT";

function visitorHash(ip: string, userAgent: string): string {
  const secret = process.env.ANALYTICS_HASH_SECRET;
  if (!secret) throw new Error("ANALYTICS_HASH_SECRET is required");
  return createHmac("sha256", secret).update(`${ip}\n${userAgent}`).digest("hex");
}

export async function recordVisit(input: { shortLinkId: string; eventType: VisitEventType; ip: string; userAgent: string }) {
  const hash = visitorHash(input.ip, input.userAgent);
  return db.linkVisit.create({ data: { shortLinkId: input.shortLinkId, eventType: input.eventType, visitorHash: hash } });
}

export async function aggregateVisits(endOfDay: Date) {
  const start = new Date(endOfDay);
  start.setUTCDate(start.getUTCDate() - 1);
  const events = await db.linkVisit.findMany({ where: { createdAt: { gte: start, lt: endOfDay } } });
  const groups = new Map<string, { pageViews: number; redirects: number; views: Set<string>; redirectsUnique: Set<string> }>();
  for (const event of events) {
    const date = new Date(event.createdAt); date.setUTCHours(0, 0, 0, 0);
    const key = `${event.shortLinkId}:${date.toISOString()}`;
    const group = groups.get(key) ?? { pageViews: 0, redirects: 0, views: new Set(), redirectsUnique: new Set() };
    if (event.eventType === "PAGE_VIEW") { group.pageViews++; group.views.add(event.visitorHash); }
    if (event.eventType === "REDIRECT") { group.redirects++; group.redirectsUnique.add(event.visitorHash); }
    groups.set(key, group);
  }
  for (const [key, group] of groups) {
    const [shortLinkId, dateIso] = key.split(":");
    await db.linkDailyStat.upsert({ where: { shortLinkId_date: { shortLinkId, date: new Date(dateIso) } }, create: { shortLinkId, date: new Date(dateIso), pageViews: group.pageViews, redirects: group.redirects, uniqueViews: group.views.size, uniqueRedirects: group.redirectsUnique.size }, update: { pageViews: group.pageViews, redirects: group.redirects, uniqueViews: group.views.size, uniqueRedirects: group.redirectsUnique.size } });
  }
  await db.linkVisit.deleteMany({ where: { createdAt: { lt: new Date(endOfDay.getTime() - 90 * 86400000) } } });
}

export function hashForTest(ip: string, userAgent: string): string { return createHash("sha256").update(`${ip}\n${userAgent}`).digest("hex"); }
