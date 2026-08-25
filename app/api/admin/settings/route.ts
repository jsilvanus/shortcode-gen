import { NextResponse } from "next/server";
import { z } from "zod";
import { getSiteSettings, saveSiteSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth/session";

const theme = z.object({ background: z.string().regex(/^#[0-9a-fA-F]{6}$/), primary: z.string().regex(/^#[0-9a-fA-F]{6}$/), secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
const settingsSchema = z.object({
  general: z.object({ siteName: z.string().min(1).max(200), siteDescription: z.string().max(1000), publicUrl: z.string().url().or(z.literal("")) }),
  linkPolicy: z.object({ allowedDomains: z.array(z.string().min(1).max(253)).max(1000), defaultPrivate: z.boolean(), defaultTtlDays: z.number().int().positive().nullable(), maxTtlDays: z.number().int().positive().nullable(), allowCustomCodes: z.boolean() }),
  privacy: z.object({ controllerName: z.string().max(200), contactEmail: z.string().email().or(z.literal("")), privacyPolicyUrl: z.string().url().or(z.literal("")), processorInfo: z.string().max(5000), analyticsDescription: z.string().max(5000) }),
  analytics: z.object({ enabled: z.boolean(), rawRetentionDays: z.literal(90), dailyAggregateRetention: z.literal("indefinite") }),
  appearance: z.object({ brandIconUrl: z.string().url().or(z.literal("")), faviconUrl: z.string().url().or(z.literal("")), footerText: z.string().max(1000), themes: z.object({ light: theme, dark: theme, contrast: theme }) }),
});

export async function GET() {
  try { await requireAdmin(); } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "ADMIN_REQUIRED" ? "Forbidden" : "Authentication required" }, { status: error instanceof Error && error.message === "ADMIN_REQUIRED" ? 403 : 401 }); }
  return NextResponse.json(await getSiteSettings());
}

export async function PUT(request: Request) {
  try { await requireAdmin(); } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "ADMIN_REQUIRED" ? "Forbidden" : "Authentication required" }, { status: error instanceof Error && error.message === "ADMIN_REQUIRED" ? 403 : 401 }); }
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  return NextResponse.json(await saveSiteSettings(parsed.data));
}
