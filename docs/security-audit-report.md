# Security audit — initial pass

Branch: `security-audit`

This audit follows an explicit actor/resource/action matrix and regression-oriented review, consistent with OWASP authorization guidance. The goal is to verify server-side authorization, input/policy enforcement, and abuse resistance rather than merely review the UI.

## Findings

### SEC-001 — Link edit bypassed target-domain and TTL policy — HIGH — fixed

`PATCH /api/links/[code]` previously accepted `targetUrl` and `expiresAt` directly into Prisma. This meant an authenticated editor of a public link could replace its target with a domain that site settings prohibit, or supply an invalid/overlong expiry.

Fix on this branch: link edits now pass target URLs through the same HTTP(S) and allowed-domain validation as creation, and expiry values through TTL validation.

### SEC-002 — `allowCustomCodes` policy was not enforced — MEDIUM — fixed

The site setting existed but `createShortLink()` still accepted custom codes whenever the request supplied one. The creation service now rejects custom codes when the policy is disabled and applies the configured default TTL when no explicit expiry is supplied.

### SEC-003 — Login endpoint has no brute-force/rate limiting — HIGH — open

`POST /api/auth/login` performs Argon2 verification but has no visible attempt throttling, account/IP backoff, or equivalent abuse control. This should be addressed before production deployment. The control must work across multiple application instances; an in-memory counter is insufficient for production.

### SEC-004 — Client-supplied proxy headers influence analytics identity — MEDIUM — open

The public short-link page currently takes the first `X-Forwarded-For` value, falling back to `X-Real-IP`. If the application can be reached directly or the reverse proxy does not overwrite these headers, a client can spoof the IP used for analytics. This does not grant authorization, but it affects privacy-preserving deduplication and statistics. Production should trust proxy-derived client IP only when the network topology guarantees the headers are authoritative, or have the edge normalize/remove them.

### SEC-005 — Public-link collaborative editing is a deliberate high-impact capability — REVIEW

The authorization policy intentionally allows any authenticated user to edit a non-private link. This is unusual for a short-link service because it permits changing the destination of another user's public link. It is not treated as an authorization bug because it matches the explicit product requirement, but it must be prominently documented and covered by regression tests.

## Authorization matrix to automate

| Actor | Own private | Own public | Other private | Other public | Site settings |
|---|---|---|---|---|---|
| Anonymous | redirect only | redirect only | redirect only | redirect only | deny |
| User | view/edit/delete | view/edit/delete | deny | view/edit/delete | deny |
| Admin | view/edit/delete | view/edit/delete | view/edit/delete | view/edit/delete | allow |

"Redirect only" means public redirect behavior is independent of dashboard authorization; private links are still publicly usable by anyone who knows the shortcode, as required by the product design.

## Next audit work

1. Add automated authorization regression tests for every link, collection, statistics, and settings endpoint.
2. Audit collection membership endpoints for IDOR and information leakage.
3. Audit statistics endpoints for private-link leakage and cross-user aggregation.
4. Audit metadata worker URL fetching for SSRF, redirect handling, DNS/private-address checks, timeout, response-size, and content-type limits.
5. Add login abuse protection.
6. Verify session lifecycle, cookie settings, logout, and session revocation.
7. Audit input length/type validation and error-message leakage.
8. Run dependency/build/static checks and review deployment-specific proxy assumptions.

## References

OWASP recommends explicit authorization matrices and automated regression tests for horizontal and vertical authorization failures. See the Authorization Testing Automation and Authorization Regression Testing cheat sheets.
