# Security audit checklist

## Authorization matrix

- [ ] Anonymous: public redirect only; no dashboard/API management access.
- [ ] User A: own links/collections readable and editable.
- [ ] User A: public links owned by User B may be viewed/edited as specified by product policy.
- [ ] User A: private links owned by User B are not readable, editable, deletable, or enumerable through management/statistics APIs.
- [ ] User A: User B's private collections are not readable or editable.
- [ ] Admin: all links/collections and site settings.
- [ ] IDs/codes guessed directly cannot bypass ownership checks.
- [ ] Every mutating/read API performs server-side authorization; client-side filtering is never security enforcement.

## Link and redirect security

- [ ] Target URLs are validated against the configured domain allowlist.
- [ ] Redirect behavior does not expose arbitrary internal services.
- [ ] Expired and inactive links do not redirect.
- [ ] Short-code lookup does not reveal whether a private dashboard resource exists.
- [ ] Brute-force/rate-limit protection is applied to shortcode enumeration and authentication.

## Metadata worker / SSRF

- [ ] Only `http`/`https` are accepted.
- [ ] Allowed domains are enforced server-side.
- [ ] DNS/IP resolution is checked so private, loopback, link-local, multicast, and metadata-service destinations cannot be reached.
- [ ] Redirect following is disabled or every redirect is independently validated against the same policy.
- [ ] Fetches have strict connect/read/total timeouts and response-size limits.
- [ ] Worker cannot use arbitrary protocols such as `file`, `gopher`, `ftp`, or `data`.
- [ ] Worker credentials/secrets are environment-only and never configurable through admin UI.

## Sessions / CSRF

- [ ] Session cookie is HttpOnly, Secure in production, and SameSite=Lax/appropriate.
- [ ] Logout invalidates the server-side session.
- [ ] Mutating cookie-authenticated requests have CSRF protection or an equivalent same-origin request mechanism.
- [ ] Login is rate limited.
- [ ] Session identifiers have sufficient entropy and expiry.

## Analytics/privacy

- [ ] Raw visit events are deleted after 90 days.
- [ ] Daily aggregates remain without visitor identifiers.
- [ ] Monthly HLL sketches contain no raw IP/User-Agent values.
- [ ] Analytics HMAC secret is environment-only.
- [ ] HLL estimates are labelled as estimates in the UI.

## Automated regression suite

Create an authorization matrix and run it in CI. At minimum test every resource/action against anonymous, owner, another user, and admin identities. Include horizontal IDOR, vertical privilege escalation, and private-resource leakage tests.

## Release gate

Do not deploy until all unchecked security items are either implemented or explicitly accepted as a documented risk.
