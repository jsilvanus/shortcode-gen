# Technical Plan Addendum

This addendum supersedes conflicting parts of `docs/technical-plan.md`.

## Account and authorization model

There are two user roles:

- `USER`
- `ADMIN`

Users can create, edit, deactivate and delete their own links.

Users can view:

- their own private links;
- links owned by other users when those links are non-private.

Users cannot edit links owned by another user.

Administrators can view and manage all links, including private links.

Administrators can also manage site settings through the UI.

## Link privacy

Every link has an `isPrivate` flag.

New links default to private.

Privacy controls management visibility; it does not make the public short URL inaccessible. A private link can still be opened by anyone who knows its URL.

## Site settings

Site settings are stored in the database rather than environment variables when they are intended to be changed through the admin UI.

The first setting is the allowed target-domain list for short links.

Example:

```text
example.com
example.org
*.example.fi
```

Domain allow-listing is separate from SSRF protection. A URL must satisfy both the configured domain policy and the outbound network safety checks.

## Analytics

Shortcode Gen records two visit event types:

- `PAGE_VIEW`: the short-link/interstitial page was requested.
- `REDIRECT`: the application actually initiated navigation to the target.

Individual visit events are retained for 90 days.

Raw IP addresses and User-Agent strings are never persisted. The event contains an HMAC-SHA256 visitor identifier derived from IP + User-Agent using a server-side `ANALYTICS_SECRET`.

Daily statistics are retained indefinitely. They contain, per link and calendar day:

- page views
- redirects
- unique page viewers
- unique redirect visitors

Daily aggregation occurs after the day has ended during a scheduled worker run. It is idempotent and may be retried. Raw events remain available for 90 days, so a missed daily aggregation can be reconstructed.

The retention job removes raw visit events older than 90 days but never removes daily aggregates.

## Phase 2 — Authentication and administration

Implement:

- user creation
- `USER` / `ADMIN` roles
- Argon2id password hashing
- server-side sessions
- HttpOnly/Secure/SameSite cookies
- login/logout
- authorization middleware/helpers
- user-facing dashboard shell
- admin dashboard shell
- admin-only site settings UI
- allowed-domain setting

**Result:** authenticated users can access the appropriate dashboard and administrators can manage global settings.

## Phase 3 — Link management

Implement link ownership and privacy together with link CRUD:

- generated codes
- custom codes
- reserved routes
- target URL validation
- owner assignment
- private/non-private flag
- TTL
- user ownership authorization
- admin access to all links

## Phase 4 — Jobs, metadata and analytics

The worker is not a continuous database poller.

Normal scheduled maintenance runs every three hours. Creating/updating a link may wake the worker immediately.

The worker handles:

- metadata jobs
- retries
- metadata refresh
- expired-link maintenance
- daily analytics aggregation
- 90-day raw visit retention

Analytics aggregation is performed for completed calendar days, not synchronously on every request.
