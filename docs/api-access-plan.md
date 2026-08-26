# API access & MCP exposure — plan

## 1. Problem

Today the only way to authenticate against Shortcode Gen is the cookie-based
session created by `POST /api/auth/login` (`lib/auth/session.ts`). Every
`app/api/**` route (except the internal `app/api/worker/*` routes, gated by a
single shared `WORKER_SECRET` bearer token) calls
`getCurrentDomainContext()`/`requireCurrentDomainMembership()`, which reads
that cookie. There is no way for a script, CLI, CI job, or LLM agent to call
the API without a browser session.

This document proposes a credential model for programmatic/third-party access
(Part 2), and sketches how that access would be exposed as an MCP server for
LLM agents (Part 3). Nothing here is implemented yet — this is the plan to
review before writing the auth mechanism.

## 2. API key model

### 2.1 What a key is scoped to

**Proposal: one key = one user + one domain**, matching an existing
`DomainMembership` row. A key is created by a domain member (for themselves)
and is only ever usable against that one domain. The key does not store a
copy of the role — every request re-resolves the role via a live
`getDomainMembership()` lookup, so a role change or membership removal takes
effect immediately, exactly like it already does for cookie sessions.

Why domain-scoped rather than "one key per user, works on every domain the
user belongs to" (which would mirror how cookie sessions behave today,
since sessions aren't domain-scoped at all — domain is resolved per-request
from the `Host` header):

- A user who is a member of five domains almost certainly wants to hand a
  single third-party integration access to *one* of them, not all five.
- If that user is later added to a sixth domain, a user-scoped key would
  silently gain access to it. A domain-scoped key can't.
- This matches how every mainstream API-key product works (Stripe restricted
  keys, GitHub fine-grained PATs, etc.): scope is fixed at issue time, not
  inherited implicitly from whatever the issuing principal can reach later.

A user can hold multiple keys (e.g. one per domain they manage, or several
for the same domain with different labels/rotation schedules).

### 2.2 Schema

```prisma
model ApiKey {
  id          String    @id @default(cuid())
  domainId    String
  userId      String
  label       String
  keyPrefix   String    @unique   // first 8 chars of the token, shown in UI, used for fast lookup
  keyHash     String              // sha256(token), never the raw token
  createdAt   DateTime  @default(now())
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  revokedAt   DateTime?
  domain      Domain    @relation(fields: [domainId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([domainId])
  @@index([userId])
}

model ApiRequestAttempt {   // rate limiting, mirrors LoginAttempt
  key       String   @id   // apiKeyId, or "ip:<ip>" for pre-auth abuse
  count     Int      @default(0)
  resetAt   DateTime
  @@index([resetAt])
}
```

### 2.3 Token format & hashing

- Generate 32 random bytes (`crypto.randomBytes(32)`), base62/base64url
  encode, prefix with `slk_` for recognizability (`slk_<43 chars>`). Shown to
  the user exactly once, at creation time — never stored or displayed again.
- Store `keyPrefix` (first 8 characters after the `slk_` prefix) in
  cleartext for lookup and for the user to recognize which key is which in
  the UI (same idea as GitHub PAT prefixes).
- Store `keyHash = sha256(token)` for verification, **not argon2**. This is a
  deliberate difference from `User.passwordHash`: argon2's slowness exists to
  slow down brute-forcing a low-entropy human password. A 256-bit random API
  token has no brute-forceable structure — argon2 here only adds latency to
  every API request for no security benefit. SHA-256 (fast, constant-time
  compare on the digest) is the standard choice for high-entropy tokens
  (this is also, in effect, what `Session.id` already does today by using
  the raw random token as a lookup key directly).
- Lookup path: `db.apiKey.findUnique({ where: { keyPrefix } })`, then
  constant-time-compare `sha256(candidate)` against `keyHash` before trusting
  it — prefix narrows the query, the hash comparison is what actually
  authenticates.

### 2.4 Request authentication

Add a bearer-token path into the *same* context resolution the app already
uses, so existing route handlers need **no changes**:

```
Authorization: Bearer slk_...
```

`getCurrentDomainContext()` (`lib/domain-context.ts`) would become, roughly:

1. Resolve `domain` from the `Host` header, as today.
2. If an `Authorization: Bearer` header is present: look up the `ApiKey` by
   prefix, verify the hash, verify it's not expired/revoked, verify
   `apiKey.domainId === domain.id` (a key issued for domain A gets a 403 if
   presented against domain B's hostname, even though the underlying user
   might also belong to B), then load the live `DomainMembership` for
   `(apiKey.userId, domain.id)` for `user`/`membership` exactly like the
   cookie path does. Touch `lastUsedAt` (fire-and-forget, not awaited).
3. Otherwise, fall back to the existing cookie-session lookup.

Every existing `app/api/links/**`, `app/api/collections/**`, and the new
`/qr` route gets bearer-token support for free, with identical authorization
semantics (`canViewLink`/`canEditLink`) to what a logged-in browser session
gets. This is the main payoff of the domain-scoped design: no route-level
code duplication.

### 2.5 Rate limiting

Reuse the `LoginAttempt` shape (`ApiRequestAttempt` above): a sliding window
per `apiKeyId`, default e.g. 300 requests / 5 minutes (configurable later via
`DomainSetting` if needed, hardcoded constant to start). Over the limit →
`429` with `Retry-After`, same pattern as `app/api/auth/login/route.ts`.
Invalid/unrecognized keys get a cheap IP-based bucket to slow down key
guessing, independent of the per-key bucket.

### 2.6 Provisioning UX

New dashboard section, `/dashboard` → "API keys" (visible to any domain
member, not just admins — a key inherits *your* role, so a USER-role member
creates a USER-scoped key for themselves, an ADMIN creates an ADMIN-scoped
one; nobody can mint a key with more access than their own membership
grants). List: label, prefix, created/last-used, revoke button. Create:
label input → server generates the token, shows it once in a
copy-to-clipboard dialog, never retrievable again.

### 2.7 Surface area gaps to fill

The existing REST surface is dashboard-shaped, not API-consumer-shaped. Two
gaps worth closing as part of this work, since a third party can't do much
with write-only or list-only endpoints:

- No `GET /api/links` (list) — only `POST` exists today; the dashboard
  fetches links directly via Prisma in the server component.
- No `GET /api/links/[code]` (single link fetch) — only `PATCH`/`DELETE`.
- No `GET /api/collections/[id]` (single collection fetch) — only
  `PATCH`/`DELETE`.
- The new `GET /api/links/[code]/qr` (this session's QR work) already fits
  the pattern and needs no change.

Beyond filling those gaps, no new resources are proposed — the plan is to
make the existing link/collection/QR/stats surface bearer-token-reachable,
not to invent a parallel API.

## 3. MCP exposure (design only, not building yet)

Once the above exists, an MCP server is a thin wrapper: each tool call maps
to one HTTP request against the API above, using a provisioned `ApiKey` as
the bearer token, with the server itself holding a single key (or one per
configured domain) supplied via its own config/env at startup — the MCP
server is just another third-party API consumer, not a special case.

Proposed location: `mcp/` directory in this repo (small Node/TS server using
`@modelcontextprotocol/sdk`), not a separate package — it has no independent
release cycle or audience, it only exists to front this service's own API,
so keeping it in-repo keeps the API and its thin wrapper from drifting apart.

Proposed initial tool set (each one calls the corresponding HTTP endpoint
above):

| MCP tool            | Backing endpoint                              |
|----------------------|-----------------------------------------------|
| `create_short_link`  | `POST /api/links`                             |
| `list_short_links`   | `GET /api/links` (new)                        |
| `get_short_link`     | `GET /api/links/[code]` (new)                 |
| `update_short_link`  | `PATCH /api/links/[code]`                     |
| `delete_short_link`  | `DELETE /api/links/[code]`                     |
| `get_link_stats`     | `GET /api/links/[code]/stats`                 |
| `get_link_qr`        | `GET /api/links/[code]/qr` (SVG or PNG)        |
| `create_collection`  | `POST /api/collections`                       |
| `list_collections`   | `GET /api/collections`                        |
| `update_collection`  | `PATCH /api/collections/[id]`                 |
| `delete_collection`  | `DELETE /api/collections/[id]`                |
| `get_collection_stats` | `GET /api/collections/[id]/stats`           |

Not proposed as MCP tools: anything under `/api/admin/**` (domain/user
management) or `/api/worker/**` (internal job runners) — those stay
operator-only surfaces, not agent-facing ones.

This section is deliberately left at sketch depth; building it is out of
scope until Part 2 (the API key mechanism) is agreed and implemented, since
the MCP server has nothing to authenticate with until then.
