# Security audit — current pass

Branch: `security-audit`

## Findings

### SEC-001 — Link edit bypassed target-domain and TTL policy — HIGH — fixed

Link edits now use the same target-domain and TTL validation as creation.

### SEC-002 — `allowCustomCodes` policy was not enforced — MEDIUM — fixed

Custom-code creation now respects the site policy and default TTL.

### SEC-003 — Login brute-force protection — mitigated, production follow-up required

Login now throttles repeated failures by IP+username for 15 minutes. The current counter is process-local and must be replaced with shared state before horizontally scaled production deployment.

### SEC-004 — Client-supplied proxy headers influence analytics identity — deployment control

Staging and production Compose deployments now keep the app unpublished and place it behind nginx/Traefik, with the proxy responsible for normalizing forwarding headers. Direct exposure of the app must remain prohibited.

### SEC-005 — Public-link collaborative editing — REVIEW

Intentional product capability: authenticated users may edit other users' public links. Keep explicit regression coverage and documentation.

## Authorization regression tests

Added `tests/authorization.test.ts` covering owner/private, other-user/private, public collaborative editing, admin access, and admin-only site settings. API-level endpoint integration tests are still required because helper-level tests cannot prove that every route invokes authorization correctly.

## SSRF hardening

Added `lib/security/safe-fetch.ts` as the worker fetch primitive. It:

- permits HTTP(S) only;
- validates the hostname against the configured allowlist when supplied;
- resolves DNS before every request and rejects private/reserved addresses;
- manually follows redirects and re-validates every destination;
- limits redirects to five;
- applies an 8-second timeout;
- enforces a 1 MB response limit;
- fails closed for unknown/non-IP address formats.

Added `tests/safe-fetch.test.ts` for private/loopback IPv4 and IPv6 handling.

**Important:** the repository currently does not contain the planned `worker/` implementation. Therefore the safe fetch primitive is not yet wired to a worker. When the metadata worker is implemented, it must use `safeFetch()` rather than raw `fetch()`.

## Remaining audit work

1. Add endpoint-level authorization tests for links, collections, statistics, and settings.
2. Verify collection membership endpoints for IDOR and information leakage.
3. Verify statistics endpoints for private-link leakage and cross-user aggregation.
4. Wire the metadata worker to `safeFetch()` when worker code lands, including content-type restrictions appropriate to metadata extraction.
5. Replace process-local login throttling with shared production state.
6. Verify session lifecycle, cookie settings, logout, and revocation.
7. Audit input limits and error-message leakage.
8. Run dependency/build/static checks.
9. Final proxy/network/container hardening review.

## Authorization matrix

| Actor | Own private | Own public | Other private | Other public | Site settings |
|---|---|---|---|---|---|
| Anonymous | redirect only | redirect only | redirect only | redirect only | deny |
| User | view/edit/delete | view/edit/delete | deny | view/edit/delete | deny |
| Admin | view/edit/delete | view/edit/delete | view/edit/delete | view/edit/delete | allow |

Private means dashboard/API privacy, not redirect privacy: knowing a private shortcode still permits public redirect as required by the product design.
