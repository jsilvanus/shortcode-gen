import { describe, expect, it } from "vitest";
import { suppressSmallCount } from "../lib/analytics";
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
