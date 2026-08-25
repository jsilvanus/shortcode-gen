import { NextResponse } from "next/server";
import { aggregateVisits } from "@/lib/analytics";

export async function POST(request: Request) {
  const secret = process.env.WORKER_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await aggregateVisits(new Date());
  return NextResponse.json({ ok: true });
}
