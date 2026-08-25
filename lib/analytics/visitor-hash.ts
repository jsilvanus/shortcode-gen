import { createHmac } from "node:crypto";

/**
 * Produces a non-reversible, server-secret-bound identifier for a request.
 * Raw IP addresses and user-agent strings are never persisted.
 */
export function hashVisitor(ip: string, userAgent: string): string {
  const secret = process.env.ANALYTICS_SECRET;
  if (!secret) throw new Error("ANALYTICS_SECRET is not configured");

  const normalizedIp = ip.trim();
  const normalizedUserAgent = userAgent.trim();
  return createHmac("sha256", secret)
    .update(`${normalizedIp}\n${normalizedUserAgent}`, "utf8")
    .digest("hex");
}
