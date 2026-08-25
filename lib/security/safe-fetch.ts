import dns from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BYTES = 1_000_000;

function isPrivateIpv4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0;
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

export function isPrivateAddress(ip: string) {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateIpv6(ip);
  return true;
}

async function assertPublicHost(hostname: string) {
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Target resolves to a private or reserved address");
}

export async function safeFetch(url: string, options: { allowedDomains?: string[]; timeoutMs?: number; maxBytes?: number } = {}) {
  let current = new URL(url);
  if (!["http:", "https:"].includes(current.protocol)) throw new Error("Only HTTP(S) targets are allowed");
  const maxRedirects = MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  for (let redirect = 0; redirect <= maxRedirects; redirect++) {
    if (options.allowedDomains?.length && !options.allowedDomains.some(domain => current.hostname === domain || current.hostname.endsWith(`.${domain}`))) throw new Error("Target domain is not allowed");
    await assertPublicHost(current.hostname);
    const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "shortcode-gen-metadata/1.0" } });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > maxBytes) throw new Error("Response is too large");
      const body = new Uint8Array(await response.arrayBuffer());
      if (body.byteLength > maxBytes) throw new Error("Response is too large");
      return { response, body };
    }
    const location = response.headers.get("location");
    if (!location) throw new Error("Redirect without a location");
    current = new URL(location, current);
    if (!["http:", "https:"].includes(current.protocol)) throw new Error("Redirect target is not HTTP(S)");
  }
  throw new Error("Too many redirects");
}
