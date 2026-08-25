import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { safeFetch } from "@/lib/security/safe-fetch";

const MAX_BYTES = 1_000_000;

function absoluteUrl(value: string, base: string): string | null {
  try { return new URL(value, base).toString(); } catch { return null; }
}

function meta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, "i");
  const match = html.match(re); return match?.[1] ?? match?.[2] ?? null;
}
function title(html: string): string | null { const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); return match?.[1]?.replace(/\s+/g, " ").trim() || null; }
function favicon(html: string, base: string): string | null {
  const match = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i) ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i);
  return match ? absoluteUrl(match[1], base) : absoluteUrl("/favicon.ico", base);
}

async function fetchPage(initialUrl: string): Promise<{ html: string; finalUrl: string }> {
  const result = await safeFetch(initialUrl, { maxBytes: MAX_BYTES });
  const contentType = (result.response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new Error("Target is not HTML");
  return { html: new TextDecoder().decode(result.body), finalUrl: result.finalUrl };
}

export async function processMetadataJob(jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { shortLink: true } });
  if (!job || job.type !== "METADATA") return;
  try {
    const result = await fetchPage(job.shortLink.targetUrl);
    const description = meta(result.html, "description") ?? meta(result.html, "og:description");
    const image = absoluteUrl(meta(result.html, "og:image") ?? "", result.finalUrl);
    const canonical = absoluteUrl(meta(result.html, "canonical") ?? "", result.finalUrl);
    const icon = favicon(result.html, result.finalUrl);
    const contentHash = createHash("sha256").update(result.html).digest("hex");
    await db.shortLink.update({ where: { id: job.shortLinkId }, data: { title: title(result.html), description, imageUrl: image, canonicalUrl: canonical, faviconUrl: icon, metadataSource: result.finalUrl, contentHash, lastCheckedAt: new Date(), lastSuccessfulFetchAt: new Date() } });
    await db.job.update({ where: { id: jobId }, data: { status: "completed", finishedAt: new Date(), attempts: { increment: 1 } } });
  } catch (error) {
    const attempts = job.attempts + 1;
    await db.job.update({ where: { id: jobId }, data: { status: attempts >= 5 ? "failed" : "pending", attempts, lastError: error instanceof Error ? error.message : "Metadata fetch failed", runAfter: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000), finishedAt: attempts >= 5 ? new Date() : null } });
  }
}

export async function enqueueMetadataJob(shortLinkId: string) { return db.job.create({ data: { type: "METADATA", shortLinkId, status: "pending", runAfter: new Date() } }); }
