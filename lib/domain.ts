import { db } from "./db";

export type DomainRole = "USER" | "ADMIN";

/** Normalize a managed hostname for storage and comparison. */
export function normalizeHostname(hostname: string): string {
  const value = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!value) throw new Error("Hostname is required");
  if (value.includes("://") || value.includes("/") || value.includes("\\") || value.includes("@") || value.includes(":") || /\s/.test(value)) {
    throw new Error("Invalid hostname");
  }
  if (value.length > 253 || value.startsWith(".") || value.endsWith(".")) throw new Error("Invalid hostname");
  const labels = value.split(".");
  if (labels.some((label) => !label || label.length > 63 || label.startsWith("-") || label.endsWith("-") || !/^[a-z0-9-]+$/.test(label))) {
    throw new Error("Invalid hostname");
  }
  return value;
}

/** Resolve either the canonical hostname or one of its aliases to the same Domain. */
export async function findDomainByHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);
  const domain = await db.domain.findUnique({ where: { hostname: normalized } });
  if (domain) return domain;
  const alias = await db.domainAlias.findUnique({ where: { hostname: normalized }, include: { domain: true } });
  return alias?.active ? alias.domain : null;
}

export async function getActiveDomainByHostname(hostname: string) {
  const domain = await findDomainByHostname(hostname);
  return domain?.active ? domain : null;
}

export async function getDomainMembership(userId: string, domainId: string) {
  return db.domainMembership.findUnique({ where: { domainId_userId: { domainId, userId } } });
}

export async function getDomainRole(userId: string, domainId: string): Promise<DomainRole | null> {
  const membership = await getDomainMembership(userId, domainId);
  if (!membership || (membership.role !== "USER" && membership.role !== "ADMIN")) return null;
  return membership.role as DomainRole;
}

export async function canAccessDomain(userId: string, domainId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === "ADMIN") return true;
  return (await getDomainMembership(userId, domainId)) !== null;
}

export async function canManageDomain(userId: string, domainId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === "ADMIN") return true;
  return (await getDomainRole(userId, domainId)) === "ADMIN";
}

/** Register an alias. The hostname cannot also be a canonical domain. */
export async function createDomainAlias(domainId: string, hostname: string) {
  const normalized = normalizeHostname(hostname);
  const canonical = await db.domain.findUnique({ where: { hostname: normalized }, select: { id: true } });
  if (canonical) throw new Error("Hostname is already a canonical domain");
  return db.domainAlias.create({ data: { domainId, hostname: normalized } });
}

export async function listDomainAliases(domainId: string) {
  return db.domainAlias.findMany({ where: { domainId }, orderBy: { hostname: "asc" } });
}

export async function deleteDomainAlias(domainId: string, aliasId: string) {
  return db.domainAlias.deleteMany({ where: { id: aliasId, domainId } });
}

export async function listDomainMembers(domainId: string) {
  return db.domainMembership.findMany({
    where: { domainId },
    include: { user: { select: { id: true, username: true, role: true } } },
    orderBy: { user: { username: "asc" } },
  });
}

export async function upsertDomainMember(domainId: string, userId: string, role: DomainRole) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("User not found");
  return db.domainMembership.upsert({
    where: { domainId_userId: { domainId, userId } },
    create: { domainId, userId, role },
    update: { role },
    include: { user: { select: { id: true, username: true, role: true } } },
  });
}

export async function removeDomainMember(domainId: string, userId: string) {
  return db.domainMembership.deleteMany({ where: { domainId, userId } });
}
