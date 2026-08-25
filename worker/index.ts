import { db } from "@/lib/db";
import { aggregateVisits } from "@/lib/analytics";
import { renderPendingMetadataJobs, runHttpChangeDetection } from "@/lib/metadata-worker";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3 * 60 * 60 * 1000);

async function cleanup() {
  await db.loginAttempt.deleteMany({ where: { resetAt: { lte: new Date() } } });
  await db.linkVisit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) } } });
}

async function statistics() {
  const now = new Date();
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await aggregateVisits(endOfDay);
}

async function runOnce() {
  await cleanup();
  await statistics();
  await runHttpChangeDetection();
  await renderPendingMetadataJobs();
}

async function main() {
  console.log(`Worker started; polling every ${POLL_MS}ms`);
  for (;;) {
    try {
      await runOnce();
    } catch (error) {
      console.error("Worker cycle failed", error);
    }
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

main().catch(error => { console.error(error); process.exit(1); });
