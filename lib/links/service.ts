import { db } from "@/lib/db";
import { canonicalizeCode, generateCode, validateCustomCode } from "@/lib/links/codes";
import { getDomainSettings, type SiteSettings, isAllowedTargetDomain } from "@/lib/settings";

export async function validateTargetUrl(targetUrl: string, domainId: string) {
  const settings = await getDomainSettings(domainId);
  const url = new URL(targetUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP(S) targets are allowed");
  if (!isAllowedTargetDomain(url.hostname, settings.linkPolicy.allowedDomains)) throw new Error("Target domain is not allowed");
  return { url, settings };
}

export function validateExpiry(expiresAt: Date | null | undefined, settings: SiteSettings) {
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error("Invalid expiration date");
  if (expiresAt && settings.linkPolicy.maxTtlDays !== null) {
    const max = Date.now() + settings.linkPolicy.maxTtlDays * 86400000;
    if (expiresAt.getTime() > max) throw new Error("TTL exceeds the configured maximum");
  }
}

export async function createShortLink(input: {
  domainId: string;
  targetUrl: string;
  ownerId: string;
  code?: string;
  isPrivate?: boolean;
  expiresAt?: Date | null;
}) {
  const { url, settings } = await validateTargetUrl(input.targetUrl, input.domainId);
  const expiresAt = input.expiresAt ?? (settings.linkPolicy.defaultTtlDays === null ? null : new Date(Date.now() + settings.linkPolicy.defaultTtlDays * 86400000));
  validateExpiry(expiresAt, settings);
  if (input.code && !settings.linkPolicy.allowCustomCodes) throw new Error("Custom codes are disabled");
  let code = input.code ? canonicalizeCode(input.code) : generateCode();
  if (input.code && !validateCustomCode(input.code)) throw new Error("Invalid custom code");
  if (!input.code) {
    for (let attempt = 0; attempt < 10; attempt++) {
      if (!(await db.shortLink.findUnique({ where: { domainId_code: { domainId: input.domainId, code } } }))) break;
      code = generateCode();
    }
  }
  const existing = await db.shortLink.findUnique({ where: { domainId_code: { domainId: input.domainId, code } } });
  if (existing) throw new Error("Code already exists");
  return db.shortLink.create({ data: { domainId: input.domainId, code, codeType: input.code ? "CUSTOM" : "GENERATED", targetUrl: url.toString(), ownerId: input.ownerId, isPrivate: input.isPrivate ?? settings.linkPolicy.defaultPrivate, expiresAt } });
}

export async function getActiveLink(domainId: string, code: string) {
  const link = await db.shortLink.findUnique({ where: { domainId_code: { domainId, code: canonicalizeCode(code) } } });
  if (!link || !link.active || (link.expiresAt && link.expiresAt <= new Date())) return null;
  return link;
}
