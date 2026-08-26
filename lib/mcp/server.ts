import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { z } from "zod";
import { GET as listLinksRoute, POST as createLinkRoute } from "@/app/api/links/route";
import { GET as getLinkRoute, PATCH as updateLinkRoute, DELETE as deleteLinkRoute } from "@/app/api/links/[code]/route";
import { GET as getLinkStatsRoute } from "@/app/api/links/[code]/stats/route";
import { GET as getLinkQrRoute } from "@/app/api/links/[code]/qr/route";
import { GET as listCollectionsRoute, POST as createCollectionRoute } from "@/app/api/collections/route";
import { GET as getCollectionRoute, PATCH as updateCollectionRoute, DELETE as deleteCollectionRoute } from "@/app/api/collections/[id]/route";
import { GET as getCollectionStatsRoute } from "@/app/api/collections/[id]/stats/route";

type ParamHandler<P extends Record<string, string>> = (request: Request, ctx: { params: Promise<P> }) => Promise<Response>;
type SimpleHandler = (request: Request) => Promise<Response>;

/**
 * Calls the exact same route handler functions the public REST API is built from, in-process —
 * no network round-trip back into the app's own HTTP server. That would mean this app calling
 * its own public hostname from inside itself (hairpin NAT territory: fragile across reverse
 * proxies, container networks, and local dev ports), for zero benefit, since it's the same
 * process either way. Authorization/domain resolution inside each handler still goes through
 * getCurrentDomainContext() reading the *original* incoming MCP request's headers via Next's
 * request-scoped headers() — the same mechanism every other route already relies on — so this
 * carries the exact same auth/rate-limiting/audit-logging behavior as a real HTTP call would.
 */
function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  });
}

async function toResult(response: Response): Promise<unknown> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(typeof (data as { error?: unknown })?.error === "string" ? (data as { error: string }).error : `Request failed with status ${response.status}`);
  return data;
}

async function callSimple(handler: SimpleHandler, url: string, method: string, body?: unknown): Promise<unknown> {
  return toResult(await handler(jsonRequest(url, method, body)));
}

async function callWithParams<P extends Record<string, string>>(handler: ParamHandler<P>, url: string, method: string, params: P, body?: unknown): Promise<unknown> {
  return toResult(await handler(jsonRequest(url, method, body), { params: Promise.resolve(params) }));
}

class BackendClient {
  listLinks() { return callSimple(listLinksRoute, "http://internal/api/links", "GET"); }
  createLink(body: unknown) { return callSimple(createLinkRoute, "http://internal/api/links", "POST", body); }
  getLink(code: string) { return callWithParams(getLinkRoute, `http://internal/api/links/${encodeURIComponent(code)}`, "GET", { code }); }
  updateLink(code: string, body: unknown) { return callWithParams(updateLinkRoute, `http://internal/api/links/${encodeURIComponent(code)}`, "PATCH", { code }, body); }
  deleteLink(code: string) { return callWithParams(deleteLinkRoute, `http://internal/api/links/${encodeURIComponent(code)}`, "DELETE", { code }); }
  getLinkStats(code: string) { return callWithParams(getLinkStatsRoute, `http://internal/api/links/${encodeURIComponent(code)}/stats`, "GET", { code }); }
  listCollections() { return callSimple(listCollectionsRoute, "http://internal/api/collections", "GET"); }
  createCollection(body: unknown) { return callSimple(createCollectionRoute, "http://internal/api/collections", "POST", body); }
  getCollection(id: string) { return callWithParams(getCollectionRoute, `http://internal/api/collections/${encodeURIComponent(id)}`, "GET", { id }); }
  updateCollection(id: string, body: unknown) { return callWithParams(updateCollectionRoute, `http://internal/api/collections/${encodeURIComponent(id)}`, "PATCH", { id }, body); }
  deleteCollection(id: string) { return callWithParams(deleteCollectionRoute, `http://internal/api/collections/${encodeURIComponent(id)}`, "DELETE", { id }); }
  getCollectionStats(id: string) { return callWithParams(getCollectionStatsRoute, `http://internal/api/collections/${encodeURIComponent(id)}/stats`, "GET", { id }); }

  /** The QR route doesn't return JSON — handled separately. */
  async getLinkQr(code: string, format: "svg" | "png"): Promise<{ contentType: string; text: string } | { contentType: string; base64: string }> {
    const response = await getLinkQrRoute(jsonRequest(`http://internal/api/links/${encodeURIComponent(code)}/qr?format=${format}`, "GET"), { params: Promise.resolve({ code }) });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(typeof data?.error === "string" ? data.error : `Request failed with status ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    if (contentType.startsWith("image/svg")) return { contentType, text: await response.text() };
    return { contentType, base64: Buffer.from(await response.arrayBuffer()).toString("base64") };
  }
}

function jsonToolResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorToolResult(error: unknown) {
  return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Unknown error" }], isError: true };
}

function jsonResource(uri: URL, data: unknown) {
  return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
}

/** Builds one fresh, stateless MCP server instance for a single request. There is nothing
 *  request-specific to pass in here: auth flows through Next's request-scoped headers(), read
 *  by getCurrentDomainContext() inside each called route handler exactly as it would for a
 *  real HTTP request — so this factory never needs a domain, key, or user baked in. */
export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "shortcode-gen", version: "1.0.0" });
  const backend = new BackendClient();

  // --- Tools: actions with side effects (model-initiated) ---

  server.registerTool("create_short_link", {
    title: "Create short link",
    description: "Create a new short link in the current domain.",
    inputSchema: z.object({
      targetUrl: z.string().describe("The destination URL the short link redirects to."),
      code: z.string().max(64).optional().describe("A custom short code. Omit to generate one automatically."),
      isPrivate: z.boolean().optional().describe("Private to its owner and domain admins, or visible to all domain members. Defaults to the domain's policy."),
      expiresAt: z.string().datetime().nullable().optional().describe("ISO 8601 expiry timestamp, or null for no expiry."),
    }),
  }, async (args) => {
    try { return jsonToolResult(await backend.createLink(args)); }
    catch (error) { return errorToolResult(error); }
  });

  server.registerTool("update_short_link", {
    title: "Update short link",
    description: "Update an existing short link's target URL, metadata, visibility, expiry, or collections.",
    inputSchema: z.object({
      code: z.string().describe("The short code identifying the link to update."),
      targetUrl: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      isPrivate: z.boolean().optional(),
      active: z.boolean().optional(),
      expiresAt: z.string().datetime().nullable().optional(),
      collectionIds: z.array(z.string()).optional().describe("Replaces the full set of collections this link belongs to."),
    }),
  }, async ({ code, ...body }) => {
    try { return jsonToolResult(await backend.updateLink(code, body)); }
    catch (error) { return errorToolResult(error); }
  });

  server.registerTool("delete_short_link", {
    title: "Delete short link",
    description: "Permanently delete a short link.",
    inputSchema: z.object({ code: z.string() }),
  }, async ({ code }) => {
    try { await backend.deleteLink(code); return jsonToolResult({ deleted: code }); }
    catch (error) { return errorToolResult(error); }
  });

  server.registerTool("create_collection", {
    title: "Create collection",
    description: "Create a new collection to group short links.",
    inputSchema: z.object({
      name: z.string(),
      description: z.string().nullable().optional(),
      isPrivate: z.boolean().optional(),
    }),
  }, async (args) => {
    try { return jsonToolResult(await backend.createCollection(args)); }
    catch (error) { return errorToolResult(error); }
  });

  server.registerTool("update_collection", {
    title: "Update collection",
    description: "Update a collection's name, description, or visibility.",
    inputSchema: z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      isPrivate: z.boolean().optional(),
    }),
  }, async ({ id, ...body }) => {
    try { return jsonToolResult(await backend.updateCollection(id, body)); }
    catch (error) { return errorToolResult(error); }
  });

  server.registerTool("delete_collection", {
    title: "Delete collection",
    description: "Delete a collection. Links in it are not deleted.",
    inputSchema: z.object({ id: z.string() }),
  }, async ({ id }) => {
    try { await backend.deleteCollection(id); return jsonToolResult({ deleted: id }); }
    catch (error) { return errorToolResult(error); }
  });

  // --- Resources: read-only data (application-controlled — the client decides what to attach) ---

  server.registerResource("short-links", "shortlinks://links", {
    title: "Short links",
    description: "All short links visible to you in the current domain.",
    mimeType: "application/json",
  }, async uri => jsonResource(uri, await backend.listLinks()));

  server.registerResource("short-link", new ResourceTemplate("shortlinks://links/{code}", { list: undefined }), {
    title: "Short link",
    description: "A single short link's details.",
    mimeType: "application/json",
  }, async (uri, { code }) => jsonResource(uri, await backend.getLink(String(code))));

  server.registerResource("short-link-stats", new ResourceTemplate("shortlinks://links/{code}/stats", { list: undefined }), {
    title: "Short link stats",
    description: "Click statistics for a short link over the last 30 days.",
    mimeType: "application/json",
  }, async (uri, { code }) => jsonResource(uri, await backend.getLinkStats(String(code))));

  server.registerResource("short-link-qr-svg", new ResourceTemplate("shortlinks://links/{code}/qr-svg", { list: undefined }), {
    title: "Short link QR code (SVG)",
    description: "The short link's QR code as inline SVG.",
    mimeType: "image/svg+xml",
  }, async (uri, { code }) => {
    const qr = await backend.getLinkQr(String(code), "svg");
    if (!("text" in qr)) throw new Error("Expected SVG text content from the QR endpoint");
    return { contents: [{ uri: uri.href, mimeType: qr.contentType, text: qr.text }] };
  });

  server.registerResource("short-link-qr-png", new ResourceTemplate("shortlinks://links/{code}/qr-png", { list: undefined }), {
    title: "Short link QR code (PNG)",
    description: "The short link's QR code as a base64-encoded PNG.",
    mimeType: "image/png",
  }, async (uri, { code }) => {
    const qr = await backend.getLinkQr(String(code), "png");
    if (!("base64" in qr)) throw new Error("Expected binary content from the QR endpoint");
    return { contents: [{ uri: uri.href, mimeType: qr.contentType, blob: qr.base64 }] };
  });

  server.registerResource("collections", "shortlinks://collections", {
    title: "Collections",
    description: "All collections visible to you in the current domain.",
    mimeType: "application/json",
  }, async uri => jsonResource(uri, await backend.listCollections()));

  server.registerResource("collection", new ResourceTemplate("shortlinks://collections/{id}", { list: undefined }), {
    title: "Collection",
    description: "A single collection's details.",
    mimeType: "application/json",
  }, async (uri, { id }) => jsonResource(uri, await backend.getCollection(String(id))));

  server.registerResource("collection-stats", new ResourceTemplate("shortlinks://collections/{id}/stats", { list: undefined }), {
    title: "Collection stats",
    description: "Aggregated click statistics for every link in a collection.",
    mimeType: "application/json",
  }, async (uri, { id }) => jsonResource(uri, await backend.getCollectionStats(String(id))));

  return server;
}
