import { db } from "@/lib/db";

export const SETTING_KEY = "site_settings";

export const DEFAULT_SETTINGS = {
  general: { siteName: "Shortcode Gen", siteDescription: "Self-hosted short-link service", publicUrl: "" },
  linkPolicy: { allowedDomains: [] as string[], defaultPrivate: true, defaultTtlDays: null as number | null, maxTtlDays: null as number | null, allowCustomCodes: true },
  privacy: { controllerName: "", contactEmail: "", privacyPolicyUrl: "", processorInfo: "", analyticsDescription: "" },
  analytics: { enabled: true, rawRetentionDays: 90, dailyAggregateRetention: "indefinite" as const },
  appearance: {
    brandIconUrl: "", faviconUrl: "", footerText: "",
    themes: {
      light: { background: "#ffffff", primary: "#6200ee", secondary: "#03dac6" },
      dark: { background: "#121212", primary: "#bb86fc", secondary: "#03dac6" },
      contrast: { background: "#000000", primary: "#ffffff", secondary: "#ffff00" },
    },
  },
} as const;

export type ThemeSettings = { background: string; primary: string; secondary: string };
export type SiteSettings = {
  general: { siteName: string; siteDescription: string; publicUrl: string };
  linkPolicy: { allowedDomains: string[]; defaultPrivate: boolean; defaultTtlDays: number | null; maxTtlDays: number | null; allowCustomCodes: boolean };
  privacy: { controllerName: string; contactEmail: string; privacyPolicyUrl: string; processorInfo: string; analyticsDescription: string };
  analytics: { enabled: boolean; rawRetentionDays: number; dailyAggregateRetention: "indefinite" };
  appearance: { brandIconUrl: string; faviconUrl: string; footerText: string; themes: { light: ThemeSettings; dark: ThemeSettings; contrast: ThemeSettings } };
};

function mergeSettings(input: Partial<SiteSettings>): SiteSettings {
  return {
    general: { ...DEFAULT_SETTINGS.general, ...input.general },
    linkPolicy: { ...DEFAULT_SETTINGS.linkPolicy, ...input.linkPolicy },
    privacy: { ...DEFAULT_SETTINGS.privacy, ...input.privacy },
    analytics: { ...DEFAULT_SETTINGS.analytics, ...input.analytics },
    appearance: {
      ...DEFAULT_SETTINGS.appearance, ...input.appearance,
      themes: {
        light: { ...DEFAULT_SETTINGS.appearance.themes.light, ...input.appearance?.themes?.light },
        dark: { ...DEFAULT_SETTINGS.appearance.themes.dark, ...input.appearance?.themes?.dark },
        contrast: { ...DEFAULT_SETTINGS.appearance.themes.contrast, ...input.appearance?.themes?.contrast },
      },
    },
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const setting = await db.siteSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!setting) return structuredClone(DEFAULT_SETTINGS) as SiteSettings;
  try { return mergeSettings(JSON.parse(setting.value) as Partial<SiteSettings>); } catch { return structuredClone(DEFAULT_SETTINGS) as SiteSettings; }
}

export async function getDomainSettings(domainId: string): Promise<SiteSettings> {
  const setting = await db.domainSetting.findUnique({ where: { domainId } });
  if (!setting) return getSiteSettings();
  try { return mergeSettings(JSON.parse(setting.value) as Partial<SiteSettings>); } catch { return getSiteSettings(); }
}

export async function saveDomainSettings(domainId: string, settings: SiteSettings): Promise<SiteSettings> {
  await db.domainSetting.upsert({
    where: { domainId },
    create: { domainId, value: JSON.stringify(settings) },
    update: { value: JSON.stringify(settings) },
  });
  return settings;
}

export async function saveSiteSettings(settings: SiteSettings): Promise<SiteSettings> {
  await db.siteSetting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value: JSON.stringify(settings) }, update: { value: JSON.stringify(settings) } });
  return settings;
}

export function isAllowedTargetDomain(hostname: string, allowedDomains: string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return allowedDomains.some((domain) => { const normalized = domain.toLowerCase().replace(/^\*\./, "").replace(/\.$/, ""); return host === normalized || host.endsWith(`.${normalized}`); });
}
