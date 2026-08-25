import { db } from "@/lib/db";
import { processMetadataJob } from "@/lib/metadata-worker";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3 * 60 * 60 * 1000);
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE ?? 20);
const CLAIM_TIMEOUT_MS = Number(process.env.WORKER_CLAIM_TIMEOUT_MS ?? 15 * 60 * 1000);

async function cleanupExpiredLoginAttempts() {
  await db.loginAttempt.deleteMany({ where: { resetAt: { lte: new Date() } } });
}

async function recoverStaleClaims() {
  const cutoff = new Date(Date.now() - CLAIM_TIMEOUT_MS);
  await db.job.updateMany({
    where: { type: "METADATA", status: "processing", startedAt: { lt: cutoff } },
    data: { status: "pending", startedAt: null, runAfter: new Date() },
  });
}

async function claimNextJob() {
  const candidate = await db.job.findFirst({
    where: { type: "METADATA", status: "pending", runAfter: { lte: new Date() } },
    orderBy: { runAfter: "asc" },
    select: { id: true },
  });
  if (!candidate) return null;

  const claimed = await db.job.updateMany({
    where: { id: candidate.id, status: "pending" },
    data: { status: "processing", startedAt: new Date() },
  });
  return claimed.count === 1 ? candidate.id : null;
}

async function runOnce() {
  await cleanupExpiredLoginAttempts();
  await recoverStaleClaims();

  let processed = 0;
  while (processed < BATCH_SIZE) {
    const jobId = await claimNextJob();
    if (!jobId) break;
    await processMetadataJob(jobId);
    processed++;
  }
  return processed;
}

async function main() {
  for (;;) {
    const count = await runOnce();
    if (count === BATCH_SIZE) continue;
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

main().catch(error => { console.error(error); process.exit(1); });
