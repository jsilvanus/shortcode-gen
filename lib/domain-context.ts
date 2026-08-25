import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveDomainByHostname, getDomainMembership } from "@/lib/domain";

export async function getRequestHostname(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost?.split(",", 1)[0]?.trim() || requestHeaders.get("host");
  if (!host) throw new Error("HOSTNAME_REQUIRED");
  return host;
}

export async function getCurrentDomain() {
  const hostname = await getRequestHostname();
  const domain = await getActiveDomainByHostname(hostname);
  if (!domain) throw new Error("DOMAIN_NOT_FOUND");
  return domain;
}

export async function getCurrentDomainContext() {
  const [domain, user] = await Promise.all([getCurrentDomain(), getCurrentUser()]);
  const membership = user ? await getDomainMembership(user.id, domain.id) : null;
  return { domain, user, membership };
}

export async function requireCurrentDomainMembership() {
  const context = await getCurrentDomainContext();
  if (!context.user) throw new Error("AUTHENTICATION_REQUIRED");
  if (!context.membership) throw new Error("DOMAIN_ACCESS_REQUIRED");
  return context;
}

export async function requireCurrentDomainAdmin() {
  const context = await requireCurrentDomainMembership();
  if (context.membership?.role !== "ADMIN") throw new Error("DOMAIN_ADMIN_REQUIRED");
  return context;
}
