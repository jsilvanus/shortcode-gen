const DEFAULT_TRUSTED_PROXY_HOPS = 1;

function getTrustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (raw === undefined || raw === "") return DEFAULT_TRUSTED_PROXY_HOPS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_TRUSTED_PROXY_HOPS;
}

/**
 * Extracts the client IP actually observed by this deployment's trusted reverse proxy chain,
 * ignoring any X-Forwarded-For entries a client could have forged before reaching it.
 *
 * X-Forwarded-For is a left-to-right chain where each hop appends the peer address *it* saw.
 * With TRUSTED_PROXY_HOPS=1 (the default: one Nginx/Traefik hop between the internet and this
 * app), the last entry is what that hop observed — everything before it is client-suppliable
 * and must not be trusted for rate limiting. A header shorter than the configured hop count
 * can't be trusted at all, so it collapses to one shared bucket rather than a client-chosen one.
 */
export function getTrustedClientIp(requestHeaders: Headers): string {
  const hops = getTrustedProxyHops();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map(part => part.trim()).filter(Boolean);
    if (hops > 0 && parts.length >= hops) return parts[parts.length - hops];
    if (parts.length > 0) return "untrusted-forwarded-for";
  }
  return requestHeaders.get("x-real-ip") || "unknown";
}
