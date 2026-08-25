import { NextResponse } from "next/server";
import { z } from "zod";
import { getSiteSettings, saveSiteSettings } from "@/lib/settings";

const settingsSchema = z.object({
  general: z.object({ siteName: z.string().min(1).max(200), siteDescription: z.string().max(1000), publicUrl: z.string().url().or(z.literal("")) }),
  linkPolicy: z.object({
    allowedDomains: z.array(z.string().min(1).max(253)).max(1000),
    defaultPrivate: z.boolean(),
    defaultTtlDays: z.number().int().positive().nullable(),
    maxTtlDays: z.number().int().positive().nullable(),
    allowCustomCodes: z.boolean(),
  }),
  privacy: z.object({ controllerName: z.string().max(200), contactEmail: z.string().email().or(z.literal("")), privacyPolicyUrl: z.string().url().or(z.literal("")), processorInfo: z.string().max(5000), analyticsDescription: z.string().max(5000) }),
  analytics: z.object({ enabled: z.boolean(), rawRetentionDays: z.literal(90), dailyAggregateRetention: z.literal("indefinite") }),
  appearance: z.object({ brandIconUrl: z.string().url().or(z.literal("")), faviconUrl: z.string().url().or(z.literal("")), footerText: z.string().max(1000) }),
});

export async function GET() {
  // Authorization middleware/session enforcement is added with the admin API phase.
  return NextResponse.json(await getSiteSettings());
}

export async function PUT(request: Request) {
  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  return NextResponse.json(await saveSiteSettings(parsed.data));
}
