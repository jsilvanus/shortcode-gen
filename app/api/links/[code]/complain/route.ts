import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getActiveLink } from "@/lib/links/service";
import { getCurrentDomain } from "@/lib/domain-context";
import { getTrustedClientIp } from "@/lib/security/client-ip";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 3;

// Reuses the same key/count/resetAt sliding-window shape as the existing API-key rate limiter
// (lib/auth/api-keys.ts) rather than introducing a second rate-limiting mechanism.
async function checkComplaintRateLimit(key: string): Promise<boolean> {
  const now = new Date();
  const existing = await db.apiRequestAttempt.findUnique({ where: { key } });
  if (!existing || existing.resetAt <= now) {
    await db.apiRequestAttempt.upsert({ where: { key }, create: { key, count: 1, resetAt: new Date(now.getTime() + WINDOW_MS) }, update: { count: 1, resetAt: new Date(now.getTime() + WINDOW_MS) } });
    return true;
  }
  if (existing.count >= MAX_PER_WINDOW) return false;
  await db.apiRequestAttempt.update({ where: { key }, data: { count: { increment: 1 } } });
  return true;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let domain;
  try {
    domain = await getCurrentDomain();
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const link = await getActiveLink(domain.id, code);
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ip = getTrustedClientIp(await headers());
  if (!(await checkComplaintRateLimit(`complain:${link.id}:${ip}`))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) return NextResponse.json({ error: "A message is required" }, { status: 400 });

  await db.linkComplaint.create({ data: { shortLinkId: link.id, message } });
  return NextResponse.json({ ok: true }, { status: 201 });
}
