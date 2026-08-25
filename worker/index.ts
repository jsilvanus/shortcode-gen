import { db } from "@/lib/db";
import { processMetadataJob } from "@/lib/metadata-worker";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3 * 60 * 60 * 1000);
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE ?? 20);

async function runOnce() {
  const jobs = await db.job.findMany({
    where: { type: "METADATA", status: "pending", runAfter: { lte: new Date() } },
    orderBy: { runAfter: "asc" },
    take: BATCH_SIZE,
    select: { id: true },
  });
  for (const job of jobs) await processMetadataJob(job.id);
  return jobs.length;
}

async function main() {
  for (;;) {
    const count = await runOnce();
    if (count === BATCH_SIZE) continue;
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

main().catch(error => { console.error(error); process.exit(1); });
