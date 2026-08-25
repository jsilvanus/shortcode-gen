# Security audit — current pass

Branch: `security-audit`

## Findings

### SEC-001 — Link edit bypassed target-domain and TTL policy — HIGH — fixed
### SEC-002 — `allowCustomCodes` policy was not enforced — MEDIUM — fixed
### SEC-003 — Login brute-force protection — fixed
Login throttles repeated failures by IP+username for 15 minutes using database-backed state, so the limit is shared across application instances. Periodic cleanup of expired rows should be included in operational maintenance.
### SEC-004 — Client-supplied proxy headers influence analytics identity — deployment control
Staging/production Compose keeps the app unpublished behind nginx/Traefik; the proxy must normalize forwarding headers.
### SEC-005 — Public-link collaborative editing — REVIEW
Intentional product capability: authenticated users may edit other users' public links. Keep explicit regression coverage.
### SEC-006 — Public collection statistics included private links — HIGH — fixed
A public collection could contain private links, and its statistics endpoint previously aggregated them for other users. Public collection statistics now exclude private links for non-owners; owners/admins retain full access.

## Endpoint authorization audit

Reviewed link CRUD, link-to-collection assignment, link statistics, collection CRUD, collection statistics, dashboard statistics, and admin settings.

- Link statistics apply link visibility authorization.
- Dashboard statistics authorize every requested link before aggregation.
- Link-to-collection assignment requires link edit access and rejects another user's private collections for normal users.
- Collection CRUD is owner/admin restricted.
- Public collection statistics exclude private links.
- Admin settings are admin-only.

Helper-level authorization tests cover the core matrix. Endpoint integration tests remain desirable once a route-handler test database harness is available.

## SSRF hardening

`lib/security/safe-fetch.ts` provides the worker fetch primitive with HTTP(S)-only URLs, allowed-domain validation, DNS/private-address checks, redirect revalidation, five-redirect limit, 8-second timeout, 1 MB response limit, and fail-closed address handling. IPv4/IPv6 private-address tests are included.

`worker/index.ts` is now present and runs pending metadata jobs on a configurable polling interval (3 hours by default). `tests/metadata-worker.test.ts` verifies that scheduled metadata processing calls `safeFetch()` and does not bypass the SSRF boundary.

## Session and input hardening

- Login rotates away the existing browser session before issuing a new session ID, reducing session accumulation and fixation risk.
- Logout deletes the server-side session and clears the cookie.
- Session cookies remain HTTP-only, `SameSite=Lax`, and `Secure` in production.
- Link creation now has a strict Zod input schema, URL/code length limits, safe JSON parsing, and generic client-facing creation errors.
- Link edit validation already rejects invalid TTLs and target URLs; remaining routes should receive the same strict-schema treatment.

## Remaining audit work

1. Audit remaining API input limits and error-message leakage.
2. Run dependency/build/static checks.
3. Final proxy/network/container hardening review.
4. Add endpoint integration tests when the test harness can exercise Next.js handlers with a test database.
5. Operational cleanup for expired LoginAttempt rows.

## Authorization matrix

| Actor | Own private | Own public | Other private | Other public | Site settings |
|---|---|---|---|---|---|
| Anonymous | redirect only | redirect only | redirect only | redirect only | deny |
| User | view/edit/delete | view/edit/delete | deny | view/edit/delete | deny |
| Admin | view/edit/delete | view/edit/delete | view/edit/delete | view/edit/delete | allow |

Private means dashboard/API privacy, not redirect privacy: knowing a private shortcode still permits public redirect as required by the product design.
