import { createMcpHandler } from "@modelcontextprotocol/server";
import { buildMcpServer } from "@/lib/mcp/server";

/**
 * The MCP-level bearer token *is* a shortcode-gen API key (`slk_...`). This layer never
 * verifies it itself: every tool/resource call goes through the exact same route handler
 * functions the public REST API uses (see lib/mcp/server.ts), which read the Authorization
 * header via Next's request-scoped headers() exactly as they do for a normal HTTP request —
 * so authentication, domain-scoping, rate limiting, and audit logging are all identical to
 * calling the REST API directly. See docs/api-access-plan.md.
 */
// Stateless idiom: no sessionIdGenerator, so a fresh McpServer is built per request — no
// baked-in key, no per-domain deployment, no state held between requests.
const handler = createMcpHandler(() => buildMcpServer());

export async function POST(request: Request) {
  return handler.fetch(request);
}

export async function GET(request: Request) {
  return handler.fetch(request);
}

export async function DELETE(request: Request) {
  return handler.fetch(request);
}
