import { db } from "@/lib/db";

export const SETTING_ALLOWED_DOMAINS = "allowed_short_code_domains";

export async function getAllowedShortCodeDomains(): Promise<string[]> {
  const setting = await db.siteSetting.findUnique({ where: { key: SETTING_ALLOWED_DOMAINS } });
  if (!setting) return [];

  try {
    const value: unknown = JSON.parse(setting.value);
    return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
  } catch {
    return [];
  }
}

export function isAllowedTargetDomain(hostname: string, allowedDomains: string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return allowedDomains.some((domain) => {
    const normalized = domain.toLowerCase().replace(/^\*\./, "").replace(/\.$/, "");
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}
