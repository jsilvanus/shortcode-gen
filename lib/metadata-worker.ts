import { createHash } from "node:crypto";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { db } from "@/lib/db";
import { assertSafeUrl, safeFetch } from "@/lib/security/safe-fetch";

const MAX_BYTES = 1_000_000;
const NAVIGATION_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT_MS ?? 20_000);
const SETTLE_MS = Number(process.env.PLAYWRIGHT_SETTLE_MS ?? 1_500);

function absoluteUrl(value: string, base: string): string | null {
  try { return new URL(value, base).toString(); } catch { return null; }
}

async function readAllowedDomains() {
  const setting = await db.siteSetting.findUnique({ where: { key: "allowedDomains" } });
  if (!setting?.value) return undefined;
  try { return JSON.parse(setting.value) as string[]; } catch { return setting.value.split(",").map(value => value.trim()).filter(Boolean); }
}

async function fetchPage(initialUrl: string, headers: Record<string, string> = {}) {
  const result = await safeFetch(initialUrl, { maxBytes: MAX_BYTES, headers });
  if (result.response.status === 304) return result;
  const contentType = (result.response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new Error("Target is not HTML");
  return result;
}

export async function runHttpChangeDetection() {
  const now = new Date();
  const links = await db.shortLink.findMany({ where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { id: true, targetUrl: true, etag: true, lastModified: true, contentHash: true, needsRender: true } });
  let changed = 0;
  for (const link of links) {
    try {
      const headers: Record<string, string> = {};
      if (link.etag) headers["If-None-Match"] = link.etag;
      if (link.lastModified) headers["If-Modified-Since"] = link.lastModified;
      const result = await fetchPage(link.targetUrl, headers);
      const response = result.response;
      const etag = response.headers.get("etag") ?? link.etag;
      const lastModified = response.headers.get("last-modified") ?? link.lastModified;
      if (response.status === 304) {
        await db.shortLink.update({ where: { id: link.id }, data: { etag, lastModified, lastCheckedAt: now } });
        continue;
      }
      const contentHash = createHash("sha256").update(result.body).digest("hex");
      const isChanged = link.contentHash !== contentHash;
      await db.shortLink.update({ where: { id: link.id }, data: { etag, lastModified, contentHash, lastCheckedAt: now, lastChangedAt: isChanged ? now : undefined, needsRender: isChanged || link.needsRender, renderStatus: isChanged ? "pending" : undefined } });
      if (isChanged) {
        changed++;
        const existing = await db.job.findFirst({ where: { shortLinkId: link.id, type: "METADATA", status: { in: ["pending", "processing"] } }, select: { id: true } });
        if (!existing) await db.job.create({ data: { type: "METADATA", shortLinkId: link.id, status: "pending", runAfter: now } });
      }
    } catch (error) {
      await db.shortLink.update({ where: { id: link.id }, data: { lastCheckedAt: now, renderError: error instanceof Error ? error.message : "HTTP check failed" } });
    }
  }
  return changed;
}

async function renderPage(browser: import("playwright").Browser, link: { id: string; targetUrl: string }) {
  const allowedDomains = await readAllowedDomains();
  await assertSafeUrl(link.targetUrl, allowedDomains);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    await context.route("**/*", async route => {
      const url = route.request().url();
      if (url.startsWith("http://") || url.startsWith("https://")) {
        try { await assertSafeUrl(url, allowedDomains); } catch { await route.abort(); return; }
      } else if (!url.startsWith("data:") && !url.startsWith("blob:")) {
        await route.abort(); return;
      }
      await route.continue();
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    await page.goto(link.targetUrl, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS });
    await page.waitForTimeout(SETTLE_MS);
    const rendered = await page.evaluate(() => ({
      title: document.title || null,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? document.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? null,
      imageUrl: document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null,
      canonicalUrl: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
      faviconUrl: document.querySelector('link[rel*="icon"]')?.getAttribute("href") ?? "/favicon.ico",
      finalUrl: location.href,
    }));
    const screenshotDir = process.env.SCREENSHOT_DIR ?? "/data/screenshots";
    await mkdir(screenshotDir, { recursive: true });
    const filename = `${link.id}.png`;
    const tmp = path.join(screenshotDir, `.${filename}.tmp`);
    const destination = path.join(screenshotDir, filename);
    await page.screenshot({ path: tmp, type: "png" });
    await rename(tmp, destination);
    return { ...rendered, imageUrl: absoluteUrl(rendered.imageUrl ?? "", rendered.finalUrl), canonicalUrl: absoluteUrl(rendered.canonicalUrl ?? "", rendered.finalUrl), faviconUrl: absoluteUrl(rendered.faviconUrl ?? "/favicon.ico", rendered.finalUrl), screenshotPath: destination };
  } finally {
    await context.close();
  }
}

export async function processMetadataJob(jobId: string, browser: import("playwright").Browser) {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { shortLink: true } });
  if (!job || job.type !== "METADATA") return;
  try {
    const rendered = await renderPage(browser, job.shortLink);
    await db.shortLink.update({ where: { id: job.shortLinkId }, data: { title: rendered.title, description: rendered.description, imageUrl: rendered.imageUrl, canonicalUrl: rendered.canonicalUrl, faviconUrl: rendered.faviconUrl, metadataSource: rendered.finalUrl, screenshotPath: rendered.screenshotPath, lastRenderedAt: new Date(), needsRender: false, renderStatus: "completed", renderError: null, lastSuccessfulFetchAt: new Date() } });
    await db.job.update({ where: { id: jobId }, data: { status: "completed", finishedAt: new Date(), attempts: { increment: 1 } } });
  } catch (error) {
    const attempts = job.attempts + 1;
    await db.job.update({ where: { id: jobId }, data: { status: attempts >= 5 ? "failed" : "pending", attempts, lastError: error instanceof Error ? error.message : "Metadata render failed", runAfter: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000), finishedAt: attempts >= 5 ? new Date() : null } });
    await db.shortLink.update({ where: { id: job.shortLinkId }, data: { renderStatus: attempts >= 5 ? "failed" : "pending", renderError: error instanceof Error ? error.message : "Metadata render failed" } });
  }
}

export async function renderPendingMetadataJobs() {
  const pending = await db.job.count({ where: { type: "METADATA", status: "pending", runAfter: { lte: new Date() } } });
  if (!pending) return;
  const browser = await chromium.launch({ headless: true });
  try {
    for (;;) {
      const now = new Date();
      const stale = new Date(now.getTime() - 15 * 60_000);
      await db.job.updateMany({ where: { type: "METADATA", status: "processing", startedAt: { lt: stale } }, data: { status: "pending", startedAt: null, runAfter: now } });
      const candidate = await db.job.findFirst({ where: { type: "METADATA", status: "pending", runAfter: { lte: now } }, orderBy: { runAfter: "asc" } });
      if (!candidate) break;
      const claimed = await db.job.updateMany({ where: { id: candidate.id, status: "pending" }, data: { status: "processing", startedAt: now } });
      if (claimed.count !== 1) continue;
      await processMetadataJob(candidate.id, browser);
    }
  } finally {
    await browser.close();
  }
}

export async function enqueueMetadataJob(shortLinkId: string) { return db.job.create({ data: { type: "METADATA", shortLinkId, status: "pending", runAfter: new Date() } }); }
