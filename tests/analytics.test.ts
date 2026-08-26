import { describe, expect, it } from "vitest";
import { suppressSmallCount, monthOverlapsRange } from "../lib/analytics";
import { MIN_REPORTED_CELL } from "../lib/analytics-constants";

describe("suppressSmallCount", () => {
  it("passes through a true zero unchanged", () => {
    expect(suppressSmallCount(0)).toBe(0);
  });

  it("suppresses nonzero counts below the reporting threshold", () => {
    for (let n = 1; n < MIN_REPORTED_CELL; n++) expect(suppressSmallCount(n)).toBeNull();
  });

  it("passes through counts at or above the reporting threshold unchanged", () => {
    expect(suppressSmallCount(MIN_REPORTED_CELL)).toBe(MIN_REPORTED_CELL);
    expect(suppressSmallCount(MIN_REPORTED_CELL + 50)).toBe(MIN_REPORTED_CELL + 50);
  });
});

describe("monthOverlapsRange", () => {
  it("excludes a month when the range's exclusive `to` lands exactly at that month's start", () => {
    // The bug this guards against: a naive year*100+month comparison treats `to` as still
    // including its own month, even though under this app's half-open [from, to) convention
    // nothing in that month is actually in range.
    const to = new Date(Date.UTC(2027, 0, 1)); // Jan 1, 2027, 00:00 — the start of January 2027
    expect(monthOverlapsRange(2027, 1, new Date(Date.UTC(2026, 0, 1)), to)).toBe(false);
    expect(monthOverlapsRange(2026, 12, new Date(Date.UTC(2026, 0, 1)), to)).toBe(true);
  });

  it("includes a month the range's `to` falls partway through", () => {
    const to = new Date(Date.UTC(2027, 2, 15)); // March 15, 2027
    expect(monthOverlapsRange(2027, 3, new Date(Date.UTC(2026, 0, 1)), to)).toBe(true);
    expect(monthOverlapsRange(2027, 4, new Date(Date.UTC(2026, 0, 1)), to)).toBe(false);
  });

  it("excludes a month when the range's inclusive `from` starts exactly at that month's end", () => {
    const from = new Date(Date.UTC(2026, 2, 1)); // March 1, 2026 — the start of March
    expect(monthOverlapsRange(2026, 2, from, new Date(Date.UTC(2026, 5, 1)))).toBe(false);
    expect(monthOverlapsRange(2026, 3, from, new Date(Date.UTC(2026, 5, 1)))).toBe(true);
  });
});
