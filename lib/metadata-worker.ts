import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { db } from "@/lib/db";

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;

function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  return p.length === 4 && (p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || p[0] === 0);
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

async function assertSafeHost(hostname: string) {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) throw new Error("Private hostname is not allowed");
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(r => r.family === 4 ? isPrivateIPv4(r.address) : isPrivateIPv6(r.address))) throw new Error("Target resolves to a private address");
}

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
  let url = initialUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Only HTTP(S) is allowed");
    await assertSafeHost(parsed.hostname);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "ShortcodeGenMetadata/1.0", accept: "text/html,application/xhtml+xml" } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Redirect without location");
        url = new URL(location, url).toString();
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!((response.headers.get("content-type") ?? "").toLowerCase().includes("text/html"))) throw new Error("Target is not HTML");
      const contentLength = Number(response.headers.get("content-length") ?? 0); if (contentLength > MAX_BYTES) throw new Error("Response too large");
      const reader = response.body?.getReader(); if (!reader) throw new Error("Response has no body");
      const chunks: Uint8Array[] = []; let total = 0;
      for (;;) { const part = await reader.read(); if (part.done) break; total += part.value.byteLength; if (total > MAX_BYTES) throw new Error("Response too large"); chunks.push(part.value); }
      return { html: new TextDecoder().decode(Buffer.concat(chunks)), finalUrl: response.url };
    } finally { clearTimeout(timer); }
  }
  throw new Error("Too many redirects");
}

export async function processMetadataJob(jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { shortLink: true } }); if (!job || job.type !== "METADATA") return;
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
