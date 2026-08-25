import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processMetadataJob } from "@/lib/metadata-worker";

export async function POST(request: Request) {
  const secret = process.env.WORKER_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const job = await db.job.findFirst({ where: { type: "METADATA", status: "pending", runAfter: { lte: new Date() } }, orderBy: { runAfter: "asc" } });
  if (!job) return NextResponse.json({ processed: 0 });
  const claimed = await db.job.updateMany({ where: { id: job.id, status: "pending" }, data: { status: "running", startedAt: new Date() } });
  if (!claimed.count) return NextResponse.json({ processed: 0 });
  await processMetadataJob(job.id);
  return NextResponse.json({ processed: 1, jobId: job.id });
}
