// Client-safe (no node/db imports) so both the server-side suppression in lib/analytics.ts and
// the client components that render suppressed counts can share the same threshold and label.
export const MIN_REPORTED_CELL = 3;
