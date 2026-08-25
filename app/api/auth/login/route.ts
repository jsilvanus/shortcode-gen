import { NextResponse } from "next/server";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

const schema = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(1024) });
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function clientKey(request: Request, username: string) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${ip}:${username.toLowerCase()}`;
}

async function isRateLimited(key: string) {
  const entry = await db.loginAttempt.findUnique({ where: { key } });
  if (!entry) return false;
  if (entry.resetAt <= new Date()) {
    await db.loginAttempt.delete({ where: { key } }).catch(() => undefined);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

async function recordFailure(key: string) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + WINDOW_MS);
  await db.loginAttempt.upsert({
    where: { key },
    create: { key, count: 1, resetAt },
    update: { count: { increment: 1 } },
  });
}

async function clearFailures(key: string) {
  await db.loginAttempt.deleteMany({ where: { key } });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  const key = clientKey(request, parsed.data.username);
  if (await isRateLimited(key)) return NextResponse.json({ error: "Too many login attempts" }, { status: 429, headers: { "Retry-After": "900" } });

  const user = await db.user.findUnique({ where: { username: parsed.data.username } });
  if (!user || !(await argon2.verify(user.passwordHash, parsed.data.password))) {
    await recordFailure(key);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await clearFailures(key);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
