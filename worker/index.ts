import { db } from "@/lib/db";
import { aggregateVisits, collapseExpiredYearlyHll } from "@/lib/analytics";
import { renderPendingMetadataJobs, runHttpChangeDetection } from "@/lib/metadata-worker";
import { purgeExpiredAuditLog } from "@/lib/audit/log";
import { purgeExpiredScreenshots } from "@/lib/screenshots";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3 * 60 * 60 * 1000);

// All of these are TTL-based cutoffs computed from `now`, not from when cleanup last ran, so a
// missed or delayed cycle never lets anything live longer than its retention period implies.
async function cleanup() {
  await db.loginAttempt.deleteMany({ where: { resetAt: { lte: new Date() } } });
  await db.apiRequestAttempt.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 90 * 86_400_000) } } });
  await db.linkVisit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) } } });
  await purgeExpiredAuditLog();
  await purgeExpiredScreenshots();
}

async function statistics() {
  const now = new Date();
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await aggregateVisits(endOfDay);
  // Must run after aggregateVisits: on Jan 1, "yesterday" (Dec 31) still belongs to the closing
  // year's last month, so collapsing before that day's aggregation lands would merge an
  // incomplete sketch. Aggregating first guarantees the closing year's HLLs are complete.
  await collapseExpiredYearlyHll(now);
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
