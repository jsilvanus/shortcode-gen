import { NextResponse } from "next/server";
import { aggregateVisits } from "@/lib/analytics";
import { purgeExpiredAuditLog } from "@/lib/audit/log";

export async function POST(request: Request) {
  const secret = process.env.WORKER_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await aggregateVisits(new Date());
  const purgedAuditLogEntries = await purgeExpiredAuditLog();
  return NextResponse.json({ ok: true, purgedAuditLogEntries });
}
