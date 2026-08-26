import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveApiKeyAuth } from "@/lib/auth/api-keys";
import { getActiveDomainByHostname, getDomainMembership } from "@/lib/domain";
import { getTrustedClientIp } from "@/lib/security/client-ip";

function getBearerToken(requestHeaders: Headers): string | null {
  const header = requestHeaders.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function getRequestHostname(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost?.split(",", 1)[0]?.trim() || requestHeaders.get("host");
  if (!host) throw new Error("HOSTNAME_REQUIRED");
  return host;
}

export async function getRequestOrigin(hostname: string): Promise<string> {
  const requestHeaders = await headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const protocol = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${protocol}://${hostname}`;
}

export async function getCurrentDomain() {
  const hostname = await getRequestHostname();
  const domain = await getActiveDomainByHostname(hostname);
  if (!domain) throw new Error("DOMAIN_NOT_FOUND");
  return domain;
}

export async function getCurrentDomainContext() {
  const domain = await getCurrentDomain();
  const requestHeaders = await headers();
  const bearer = getBearerToken(requestHeaders);
  if (bearer) {
    const result = await resolveApiKeyAuth(bearer, domain.id, getTrustedClientIp(requestHeaders));
    if (result.status === "rate_limited") return { domain, user: null, membership: null, rateLimited: true, authMethod: "api_key" as const, apiKeyId: null };
    if (result.status === "invalid") return { domain, user: null, membership: null, rateLimited: false, authMethod: "api_key" as const, apiKeyId: null };
    return { domain, user: result.user, membership: result.membership, rateLimited: false, authMethod: "api_key" as const, apiKeyId: result.apiKeyId };
  }
  const user = await getCurrentUser();
  const membership = user ? await getDomainMembership(user.id, domain.id) : null;
  return { domain, user, membership, rateLimited: false, authMethod: "session" as const, apiKeyId: null };
}

export async function requireCurrentDomainMembership() {
  const context = await getCurrentDomainContext();
  if (context.rateLimited) throw new Error("RATE_LIMITED");
  if (!context.user) throw new Error("AUTHENTICATION_REQUIRED");
  if (!context.membership) throw new Error("DOMAIN_ACCESS_REQUIRED");
  return { domain: context.domain, user: context.user, membership: context.membership, authMethod: context.authMethod, apiKeyId: context.apiKeyId };
}

export async function requireCurrentDomainAdmin() {
  const context = await requireCurrentDomainMembership();
  if (context.membership.role !== "ADMIN") throw new Error("DOMAIN_ADMIN_REQUIRED");
  return context;
}

/** Maps the sentinel errors thrown by requireCurrentDomain* to HTTP status codes. */
export function authErrorStatus(message: string, fallback: number): number {
  if (message === "RATE_LIMITED") return 429;
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  return fallback;
}
