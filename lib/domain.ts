import { db } from "./db";

export type DomainRole = "USER" | "ADMIN";

/**
 * Normalize a public hostname before storing or comparing it.
 * Hostnames are case-insensitive and may arrive with a trailing dot.
 */
export function normalizeHostname(hostname: string): string {
  const value = hostname.trim().toLowerCase().replace(/\.$/, "");

  if (!value) {
    throw new Error("Hostname is required");
  }

  // A managed domain is a hostname, not a URL. Reject schemes, paths,
  // credentials, ports and whitespace rather than silently accepting them.
  if (
    value.includes("://") ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("@") ||
    value.includes(":") ||
    /\s/.test(value)
  ) {
    throw new Error("Invalid hostname");
  }

  if (value.length > 253 || value.startsWith(".") || value.endsWith(".")) {
    throw new Error("Invalid hostname");
  }

  const labels = value.split(".");
  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-") ||
        !/^[a-z0-9-]+$/.test(label),
    )
  ) {
    throw new Error("Invalid hostname");
  }

  return value;
}

export async function findDomainByHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);
  return db.domain.findUnique({ where: { hostname: normalized } });
}

export async function getActiveDomainByHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);
  return db.domain.findFirst({
    where: { hostname: normalized, active: true },
  });
}

export async function getDomainMembership(userId: string, domainId: string) {
  return db.domainMembership.findUnique({
    where: { domainId_userId: { domainId, userId } },
  });
}

export async function getDomainRole(userId: string, domainId: string): Promise<DomainRole | null> {
  const membership = await getDomainMembership(userId, domainId);
  if (!membership || (membership.role !== "USER" && membership.role !== "ADMIN")) {
    return null;
  }
  return membership.role as DomainRole;
}

export async function canAccessDomain(userId: string, domainId: string) {
  return (await getDomainMembership(userId, domainId)) !== null;
}

export async function canManageDomain(userId: string, domainId: string) {
  return (await getDomainRole(userId, domainId)) === "ADMIN";
}
