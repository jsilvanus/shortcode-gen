import { MIN_REPORTED_CELL } from "@/lib/analytics-constants";

// A null count means the stats API suppressed a small nonzero value (see suppressSmallCount in
// lib/analytics.ts) rather than that nothing happened.
export function formatCount(value: number | null): string {
  return value === null ? `< ${MIN_REPORTED_CELL}` : value.toLocaleString();
}
