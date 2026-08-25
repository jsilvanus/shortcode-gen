import { db } from "@/lib/db";
import { canonicalizeCode, generateCode, validateCustomCode } from "@/lib/links/codes";
import { getSiteSettings, isAllowedTargetDomain } from "@/lib/settings";

export async function createShortLink(input: {
  targetUrl: string;
  ownerId: string;
  code?: string;
  isPrivate?: boolean;
  expiresAt?: Date | null;
}) {
  const settings = await getSiteSettings();
  const url = new URL(input.targetUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP(S) targets are allowed");
  if (!isAllowedTargetDomain(url.hostname, settings.linkPolicy.allowedDomains)) throw new Error("Target domain is not allowed");
  if (input.expiresAt && settings.linkPolicy.maxTtlDays !== null) {
    const max = Date.now() + settings.linkPolicy.maxTtlDays * 86400000;
    if (input.expiresAt.getTime() > max) throw new Error("TTL exceeds the configured maximum");
  }

  let code = input.code ? canonicalizeCode(input.code) : generateCode();
  if (input.code && !validateCustomCode(input.code)) throw new Error("Invalid custom code");
  if (!input.code) {
    for (let attempt = 0; attempt < 10; attempt++) {
      if (!(await db.shortLink.findUnique({ where: { code } }))) break;
      code = generateCode();
    }
  }

  const existing = await db.shortLink.findUnique({ where: { code } });
  if (existing) throw new Error("Code already exists");
  return db.shortLink.create({ data: {
    code, codeType: input.code ? "CUSTOM" : "GENERATED", targetUrl: url.toString(), ownerId: input.ownerId,
    isPrivate: input.isPrivate ?? settings.linkPolicy.defaultPrivate, expiresAt: input.expiresAt ?? null,
  } });
}

export async function getActiveLink(code: string) {
  const link = await db.shortLink.findUnique({ where: { code: canonicalizeCode(code) } });
  if (!link || !link.active || (link.expiresAt && link.expiresAt <= new Date())) return null;
  return link;
}
