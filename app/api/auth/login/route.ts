import { NextResponse } from "next/server";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

const schema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1),
});

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request, username: string) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${ip}:${username.toLowerCase()}`;
}

function isRateLimited(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count++;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  const key = clientKey(request, parsed.data.username);
  if (isRateLimited(key)) return NextResponse.json({ error: "Too many login attempts" }, { status: 429, headers: { "Retry-After": "900" } });

  const user = await db.user.findUnique({ where: { username: parsed.data.username } });
  if (!user || !(await argon2.verify(user.passwordHash, parsed.data.password))) {
    recordFailure(key);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  attempts.delete(key);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
