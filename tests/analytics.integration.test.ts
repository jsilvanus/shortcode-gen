import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { collapseExpiredYearlyHll, estimateLinkUniqueRange } from "../lib/analytics";
import { addHll, emptyHll, encodeHll, estimateHll, mergeHll } from "../lib/hll";

function sketchFor(hashes: string[]): Uint8Array {
  const registers = emptyHll();
  for (const hash of hashes) addHll(registers, hash);
  return registers;
}

describe("yearly HLL collapse", () => {
  const suffix = Date.now().toString();
  let user: { id: string };
  let domain: { id: string };
  let link: { id: string };
  const pastYear = new Date().getUTCFullYear() - 1;
  const currentYear = new Date().getUTCFullYear();

  const janHashes = ["visitor-a", "visitor-b", "visitor-c"];
  const febHashes = ["visitor-b", "visitor-d"]; // overlaps with January on visitor-b

  beforeAll(async () => {
    user = await db.user.create({ data: { username: `hll-user-${suffix}`, passwordHash: "test" }, select: { id: true } });
    domain = await db.domain.create({ data: { hostname: `hll-${suffix}.example.test`, name: "HLL domain" }, select: { id: true } });
    link = await db.shortLink.create({
      data: { domainId: domain.id, code: `hll${suffix}`, codeType: "GENERATED", targetUrl: "https://example.com", ownerId: user.id },
      select: { id: true },
    });
    await db.linkMonthlyStat.create({ data: { shortLinkId: link.id, year: pastYear, month: 1, uniqueViewsHll: encodeHll(sketchFor(janHashes)), uniqueRedirectsHll: encodeHll(emptyHll()) } });
    await db.linkMonthlyStat.create({ data: { shortLinkId: link.id, year: pastYear, month: 2, uniqueViewsHll: encodeHll(sketchFor(febHashes)), uniqueRedirectsHll: encodeHll(emptyHll()) } });
    // Live January of the *next* year, right at the boundary a "whole past year" query's
    // exclusive `to` (Jan 1 of that next year) sits on — this is exactly the case
    // monthOverlapsRange must exclude; see the boundary test below.
    await db.linkMonthlyStat.create({ data: { shortLinkId: link.id, year: currentYear, month: 1, uniqueViewsHll: encodeHll(sketchFor(["visitor-live"])), uniqueRedirectsHll: encodeHll(emptyHll()) } });
  });

  afterAll(async () => {
    await db.shortLink.delete({ where: { id: link.id } });
    await db.domain.delete({ where: { id: domain.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  });

  it("merges a closed year's months into an exact union before collapsing them to scalars", async () => {
    const expectedYearlyUnique = estimateHll(mergeHll([sketchFor(janHashes), sketchFor(febHashes)]));
    const collapsedLinks = await collapseExpiredYearlyHll(new Date(Date.UTC(currentYear, 5, 1)));
    expect(collapsedLinks).toBeGreaterThanOrEqual(1);

    const yearly = await db.linkYearlyStat.findUnique({ where: { shortLinkId_year: { shortLinkId: link.id, year: pastYear } } });
    expect(yearly?.uniqueViews).toBe(expectedYearlyUnique);

    const jan = await db.linkMonthlyStat.findUnique({ where: { shortLinkId_year_month: { shortLinkId: link.id, year: pastYear, month: 1 } } });
    expect(jan?.uniqueViewsHll).toBeNull();
    expect(jan?.uniqueViewsEstimate).toBe(estimateHll(sketchFor(janHashes)));

    // The current year's month is still live — collapse must never touch it.
    const liveMonth = await db.linkMonthlyStat.findUnique({ where: { shortLinkId_year_month: { shortLinkId: link.id, year: currentYear, month: 1 } } });
    expect(liveMonth?.uniqueViewsHll).not.toBeNull();
  });

  it("is idempotent — running collapse again doesn't change an already-collapsed year", async () => {
    const before = await db.linkYearlyStat.findUnique({ where: { shortLinkId_year: { shortLinkId: link.id, year: pastYear } } });
    await collapseExpiredYearlyHll(new Date(Date.UTC(currentYear, 5, 1)));
    const after = await db.linkYearlyStat.findUnique({ where: { shortLinkId_year: { shortLinkId: link.id, year: pastYear } } });
    expect(after?.uniqueViews).toBe(before?.uniqueViews);
  });

  it("uses the exact yearly union for a range covering the whole closed year, excluding the next year's live January", async () => {
    // A "whole past year" range's exclusive `to` (Jan 1 of the next year) sits exactly at the
    // start of next January, which has live (uncollapsed) data of its own — the fix under test is
    // that this boundary month must not bleed into the previous year's total.
    const expectedYearlyUnique = estimateHll(mergeHll([sketchFor(janHashes), sketchFor(febHashes)]));
    const result = await estimateLinkUniqueRange(link.id, new Date(Date.UTC(pastYear, 0, 1)), new Date(Date.UTC(pastYear + 1, 0, 1)));
    expect(result.uniqueViews).toBe(expectedYearlyUnique);
  });

  it("falls back to a single month's scalar for a partial slice of a closed year", async () => {
    const result = await estimateLinkUniqueRange(link.id, new Date(Date.UTC(pastYear, 0, 1)), new Date(Date.UTC(pastYear, 0, 20)));
    expect(result.uniqueViews).toBe(estimateHll(sketchFor(janHashes)));
  });
});
