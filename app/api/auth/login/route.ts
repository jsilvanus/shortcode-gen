import { NextResponse } from "next/server";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

const schema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });

  const user = await db.user.findUnique({ where: { username: parsed.data.username } });
  if (!user || !(await argon2.verify(user.passwordHash, parsed.data.password))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
