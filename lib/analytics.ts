import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { addHll, decodeHll, emptyHll, encodeHll, estimateHll, mergeHll } from "@/lib/hll";
import { MIN_REPORTED_CELL } from "@/lib/analytics-constants";

export type VisitEventType = "PAGE_VIEW" | "REDIRECT";

/**
 * A nonzero count under this threshold pinpoints "a specific handful of people, on this specific
 * day/link" almost as precisely as naming them — a real risk for a viewer who isn't the link's
 * owner (another domain member on a public link, or an admin on someone else's private one).
 * True zeros and genuinely aggregate counts pass through unchanged; only that thin "somebody, but
 * very few" band gets hidden from stats API responses.
 */
export function suppressSmallCount(n: number): number | null {
  return n > 0 && n < MIN_REPORTED_CELL ? null : n;
}

// Scoped per link (not just per year+ip+useragent) so the same visitor hashes differently on
// every link — without this, one person's hash was stable across every link and domain in the
// deployment for up to a year, letting anyone with the hashes correlate which links a single
// visitor opened. Per-link scoping confines a hash to "did this visitor hit this link", not
// "everything this visitor did across the whole site".
function visitorHash(shortLinkId: string, ip: string, userAgent: string, year: number): string {
  const secret = process.env.ANALYTICS_HASH_SECRET;
  if (!secret) throw new Error("ANALYTICS_HASH_SECRET is required");
  return createHmac("sha256", secret).update(`${year}\n${shortLinkId}\n${ip}\n${userAgent}`).digest("hex");
}

export async function recordVisit(input: { shortLinkId: string; eventType: VisitEventType; ip: string; userAgent: string }) {
  const year = new Date().getUTCFullYear();
  return db.linkVisit.create({ data: { shortLinkId: input.shortLinkId, eventType: input.eventType, visitorHash: visitorHash(input.shortLinkId, input.ip, input.userAgent, year) } });
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
    // A null column means this month was already collapsed to a scalar (see collapseExpiredYearlyHll)
    // — starting a fresh sketch here is safe either way: it only happens for the last day of an
    // already-closed year racing the collapse job, and the next collapse pass folds it back in.
    const viewHll = monthStats?.uniqueViewsHll ? decodeHll(monthStats.uniqueViewsHll) : emptyHll();
    const redirectHll = monthStats?.uniqueRedirectsHll ? decodeHll(monthStats.uniqueRedirectsHll) : emptyHll();
    for (const hash of group.views) addHll(viewHll, hash);
    for (const hash of group.redirectsUnique) addHll(redirectHll, hash);
    await db.linkMonthlyStat.upsert({ where: { shortLinkId_year_month: { shortLinkId, year: group.year, month: group.month } }, create: { shortLinkId, year: group.year, month: group.month, uniqueViewsHll: encodeHll(viewHll), uniqueRedirectsHll: encodeHll(redirectHll) }, update: { uniqueViewsHll: encodeHll(viewHll), uniqueRedirectsHll: encodeHll(redirectHll) } });
  }
  await db.linkVisit.deleteMany({ where: { createdAt: { lt: new Date(endOfDay.getTime() - 90 * 86400000) } } });
}

/**
 * Once a calendar year has closed, its monthly HLL sketches no longer need to stay mergeable —
 * so this merges each link's closed-year months into one true union (an exact distinct count,
 * computed while the sketches still exist) into LinkYearlyStat, then collapses every month row
 * to a plain scalar and drops the HLL columns. That closes the HLL membership-inference window
 * at one year rather than leaving the raw sketches around indefinitely, while keeping the yearly
 * figure an honest union instead of a sum-of-months overcount.
 */
export async function collapseExpiredYearlyHll(now = new Date()): Promise<number> {
  const currentYear = now.getUTCFullYear();
  const staleMonths = await db.linkMonthlyStat.findMany({
    where: { year: { lt: currentYear }, OR: [{ uniqueViewsHll: { not: null } }, { uniqueRedirectsHll: { not: null } }] },
    orderBy: [{ shortLinkId: "asc" }, { year: "asc" }],
  });
  const byLinkYear = new Map<string, typeof staleMonths>();
  for (const month of staleMonths) {
    const key = `${month.shortLinkId}:${month.year}`;
    const group = byLinkYear.get(key) ?? [];
    group.push(month);
    byLinkYear.set(key, group);
  }
  for (const [key, months] of byLinkYear) {
    const [shortLinkId, yearStr] = key.split(":");
    const year = Number(yearStr);
    const viewsUnion = mergeHll(months.filter(m => m.uniqueViewsHll).map(m => decodeHll(m.uniqueViewsHll!)));
    const redirectsUnion = mergeHll(months.filter(m => m.uniqueRedirectsHll).map(m => decodeHll(m.uniqueRedirectsHll!)));
    await db.linkYearlyStat.upsert({
      where: { shortLinkId_year: { shortLinkId, year } },
      create: { shortLinkId, year, uniqueViews: estimateHll(viewsUnion), uniqueRedirects: estimateHll(redirectsUnion) },
      update: { uniqueViews: estimateHll(viewsUnion), uniqueRedirects: estimateHll(redirectsUnion) },
    });
    for (const month of months) {
      await db.linkMonthlyStat.update({
        where: { id: month.id },
        data: {
          uniqueViewsEstimate: month.uniqueViewsHll ? estimateHll(decodeHll(month.uniqueViewsHll)) : month.uniqueViewsEstimate,
          uniqueRedirectsEstimate: month.uniqueRedirectsHll ? estimateHll(decodeHll(month.uniqueRedirectsHll)) : month.uniqueRedirectsEstimate,
          uniqueViewsHll: null,
          uniqueRedirectsHll: null,
        },
      });
    }
  }
  return byLinkYear.size;
}

/**
 * Whether calendar month `year`-`month` overlaps the half-open range [from, to) — the range
 * convention used elsewhere in this app (e.g. LinkDailyStat queries use `date: { gte: from, lt:
 * to } }`). A plain `year*100+month` comparison against `to`'s own year/month incorrectly treats
 * a `to` that lands exactly at a month's start (midnight on the 1st) as still including that
 * whole month, even though no instant within it is actually in range.
 */
export function monthOverlapsRange(year: number, month: number, from: Date, to: Date): boolean {
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 1);
  return monthStart < to.getTime() && monthEnd > from.getTime();
}

type MonthlyHllRow = { uniqueViewsHll: string | null; uniqueRedirectsHll: string | null; uniqueViewsEstimate: number | null; uniqueRedirectsEstimate: number | null };

/** A month's unique-views estimate, from the live sketch if still present, else the scalar left behind by collapseExpiredYearlyHll. */
export function monthlyUniqueViews(m: MonthlyHllRow): number {
  return m.uniqueViewsHll ? estimateHll(decodeHll(m.uniqueViewsHll)) : (m.uniqueViewsEstimate ?? 0);
}

/** A month's unique-redirects estimate, from the live sketch if still present, else the scalar left behind by collapseExpiredYearlyHll. */
export function monthlyUniqueRedirects(m: MonthlyHllRow): number {
  return m.uniqueRedirectsHll ? estimateHll(decodeHll(m.uniqueRedirectsHll)) : (m.uniqueRedirectsEstimate ?? 0);
}

/**
 * Distinct-visitor totals for one link over [from, to), using the most precise data available
 * for each part of the range: a live HLL union for months that haven't been collapsed yet (exact
 * for that portion), the stored LinkYearlyStat union for any whole closed calendar year fully
 * covered by the range (also exact — it was computed by merging that year's sketches before they
 * were discarded), and a fallback sum of monthly scalars only for a partial slice of a closed
 * year, where the underlying sketch no longer exists to merge exactly.
 */
export async function estimateLinkUniqueRange(shortLinkId: string, from: Date, to: Date): Promise<{ uniqueViews: number; uniqueRedirects: number }> {
  const monthly = await db.linkMonthlyStat.findMany({ where: { shortLinkId } });
  const inRange = monthly.filter(m => monthOverlapsRange(m.year, m.month, from, to));
  const live = inRange.filter(m => m.uniqueViewsHll || m.uniqueRedirectsHll);
  const collapsed = inRange.filter(m => !m.uniqueViewsHll && !m.uniqueRedirectsHll);

  const liveViews = estimateHll(mergeHll(live.map(m => m.uniqueViewsHll ? decodeHll(m.uniqueViewsHll) : emptyHll())));
  const liveRedirects = estimateHll(mergeHll(live.map(m => m.uniqueRedirectsHll ? decodeHll(m.uniqueRedirectsHll) : emptyHll())));

  let collapsedViews = 0;
  let collapsedRedirects = 0;
  const collapsedYears = [...new Set(collapsed.map(m => m.year))];
  if (collapsedYears.length) {
    const yearlyStats = await db.linkYearlyStat.findMany({ where: { shortLinkId, year: { in: collapsedYears } } });
    for (const year of collapsedYears) {
      const wholeYearInRange = from.getTime() <= Date.UTC(year, 0, 1) && to.getTime() >= Date.UTC(year + 1, 0, 1);
      const yearly = yearlyStats.find(y => y.year === year);
      if (wholeYearInRange && yearly) {
        collapsedViews += yearly.uniqueViews;
        collapsedRedirects += yearly.uniqueRedirects;
      } else {
        for (const m of collapsed.filter(m => m.year === year)) {
          collapsedViews += m.uniqueViewsEstimate ?? 0;
          collapsedRedirects += m.uniqueRedirectsEstimate ?? 0;
        }
      }
    }
  }
  return { uniqueViews: liveViews + collapsedViews, uniqueRedirects: liveRedirects + collapsedRedirects };
}
