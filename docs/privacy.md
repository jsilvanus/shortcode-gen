# Privacy and Data Protection

**Assessment date:** 2026-08-26

This document describes privacy-relevant behaviour visible in the current Shortcode Gen implementation. It is an engineering document, not legal advice and not a determination that every deployment is GDPR compliant.

## Scope

Shortcode Gen can process information about:

- administrators and domain members;
- API clients;
- public visitors;
- content referenced by target URLs.

The operator deploying Shortcode Gen is responsible for determining the applicable legal roles, purposes, lawful bases, notices, retention periods and data-subject procedures for the deployment.

## Privacy principles used in the design

The project aims to apply:

- data minimisation;
- purpose limitation;
- least-privilege access;
- separation of tenants/domains;
- pseudonymization where identity is not required;
- deletion where data is no longer needed;
- privacy-aware audit logging;
- avoiding unnecessary exposure of credentials.

## Main categories of processing

### Authentication and administration

Usernames, password hashes, sessions, domain memberships and related security state are processed to authenticate users and authorize administration.

Passwords are stored as Argon2 hashes rather than plaintext passwords. Sessions are server-side.

### Short-link management

The service stores target URLs, ownership, domain association and optional metadata. Target URLs can themselves contain personal data; the application cannot classify their content in advance.

### Metadata and screenshots

The worker fetches administrator-supplied URLs and may render them with a browser. This can copy information from third-party pages into metadata fields or screenshots (captured in both a landscape and a portrait variant, shown on the public link-preview page). Operators should therefore treat the metadata/rendering pipeline as a data-processing boundary. A link owner/admin can disable screenshot capture for a given link entirely.

### Link reports

Public visitors can submit a free-text report about a link from its preview page. Report messages are stored with the link but without any identifier for the reporter; operators should be aware that a visitor could still voluntarily include personal data (their own or someone else's) in the free-text message itself.

### Analytics

The current implementation includes visit events, visitor hashes and aggregate daily/monthly statistics. These are potentially personal-data processing activities and require an explicit deployment-level retention and lawful-basis assessment.

A hash is not automatically anonymous simply because the original identifier is not stored in clear text. The visitor hash is scoped per short link (it is derived from the year, the link's own ID, the IP address and the user agent), so it cannot be used to correlate one visitor's activity across different links or domains in the same deployment — a hash only ever answers "did this visitor hit this link", not "everything this visitor did across the site".

Separately, the plain integer counts in `LinkDailyStat`/`LinkMonthlyStat` (page views, redirects, unique views/redirects) carry their own small-cell disclosure risk: for a low-traffic link, an exact small count (e.g. "1 unique view") can itself identify that a specific known recipient acted on a specific day, to any viewer who already knows who the link was sent to — and that viewer isn't necessarily the link's own owner, since other domain members can see stats for non-private links they don't own and admins can see stats for every link. The stats API now suppresses this: any nonzero count below a small reporting threshold is returned as `null` rather than the exact number, in both the daily/monthly breakdowns and the range totals. This addresses disclosure in what's served; it is not a retention schedule for the underlying `LinkDailyStat` rows, which remains open (see Retention below).

The monthly HLL sketch itself carries a different, narrower risk: because it's a deterministic function of the actual visitor hashes merged into it, an insider who already holds `ANALYTICS_HASH_SECRET` and a target's IP/user-agent can test whether that person's hash was merged in (a one-sided test — it can prove absence, not presence). This required the same privileged access as reading raw visit rows directly, but unlike those rows (90-day retention) the sketches previously never expired. They now do: once a calendar year closes, the worker merges that year's months into one exact union (`LinkYearlyStat`, computed before the sketches are discarded) and collapses each month to a plain scalar, deleting the HLL columns — closing that exposure at one year instead of leaving it open indefinitely.

### Audit logging

Audit records are designed to avoid storing raw user IDs. The implementation derives an actor pseudonym from a per-user salt and an HMAC secret. API-key events can receive a separate pseudonym.

The user's audit salt is deleted with the user, intentionally preventing future reconstruction of the identity association for historical entries.

Audit-log purging (180-day retention) runs as part of the background worker's regular cleanup cycle, so it is enforced by default rather than depending on an operator wiring up an external scheduled call.

## Access control

Domain membership is the principal tenant authorization mechanism. A user may have different roles in different domains. API keys are associated with a domain and user.

This provides a technical basis for tenant separation, but authorization must remain covered by automated regression tests.

## Data minimisation

The design deliberately avoids storing raw IP addresses and raw API-key secrets in the core link/audit models. Analytics uses a visitor hash rather than an IP address field.

This is a minimisation measure, not a guarantee that analytics are anonymous.

## Retention

The implementation contains timestamps and expiry fields, but a complete, operator-configurable privacy retention policy is not yet represented for every data category.

A deployment should explicitly define retention for:

- user accounts;
- sessions;
- audit logs (enforced: 180 days, purged by the worker);
- API keys;
- visit events (enforced: 90 days);
- rate-limit attempt state (enforced: `LoginAttempt` at reset, `ApiRequestAttempt` 90 days after reset);
- monthly unique-visitor sketches (enforced: collapsed to a scalar and deleted once their calendar year closes — see Analytics above);
- daily statistics and yearly unique-visitor statistics (`LinkDailyStat`, `LinkYearlyStat` row retention — not yet defined; small-cell disclosure in what they expose is mitigated separately, see Analytics above);
- screenshots (enforced for expiry — see below — but not for links that are simply never re-rendered);
- metadata;
- expired links (the link record itself is not purged automatically — see "Expiry is not deletion" below);
- failed/completed jobs.

Retention must be based on purpose and legal/operational requirements rather than simply keeping everything indefinitely.

## Deletion

**Expiry is not deletion.** A link's `expiresAt` only stops the public redirect page from resolving the link (`getActiveLink`); it does not delete the `ShortLink` row, its target URL, title/description, or metadata. Full deletion of a link is a manual admin action (`DELETE /api/links/[code]`). Operators who want expired links actually purged need to build that as an explicit, separate operational process — expiry should not be assumed to satisfy a storage-limitation or erasure obligation on its own.

Screenshots are the one exception to that: because they're a copy of third-party page content with no remaining purpose once a link can no longer be reached publicly, the worker automatically deletes screenshot files (and clears the path fields) once `expiresAt` has passed, independently of whether the link record itself is ever deleted. Screenshot files are also deleted immediately when a link is deleted, when a link's screenshot re-renders (the new file atomically replaces the old one in place), and when an owner/admin explicitly disables the screenshot for a link.

Deletion of a user cascades to the user's audit salt. This is an intentional crypto-shredding mechanism for historical actor linkage.

Domain/link deletion also uses database relationships with cascading behaviour in relevant models. Deleting a link now also deletes its screenshot files. Operators still need to consider backups when implementing complete deletion workflows.

## Data subject rights

The application does not currently claim to provide a complete automated GDPR data-subject-rights workflow.

A deployment should have a documented process for receiving, authenticating, assessing and fulfilling applicable requests such as access, rectification, erasure, restriction and objection.

## Privacy by design

Examples already present in the implementation include:

- domain-scoped authorization;
- hashed passwords;
- hashed API keys;
- pseudonymized audit actors;
- per-user audit salts;
- crypto-shredding of the audit mapping on user deletion;
- no raw IP field in the visit model;
- separation of public link access from administrative data.

## Privacy risks requiring further work

1. Visitor hashes may remain personal data.
2. Target URLs may contain personal or sensitive data.
3. Screenshots can capture arbitrary personal information.
4. Metadata can copy personal information from target pages.
5. Audit logs can contain pseudonymous but linkable activity.
6. Backups can retain deleted data after live deletion.
7. External target servers and infrastructure providers may process personal data during metadata fetching.
8. The operator's legal role and lawful basis are deployment-specific.

## DPIA consideration

The project should not claim that a Data Protection Impact Assessment is universally unnecessary. Whether a DPIA is required depends on the deployment's processing activities and risk, not merely on the existence of the software.

The operator should perform a DPIA screening and document the result where analytics, large-scale public tracking, sensitive target content, systematic monitoring or other high-risk processing is involved.

## Third parties and transfers

Shortcode Gen may make outbound requests to target URLs. Those target operators and infrastructure providers may receive the normal network information associated with the request.

The deployment operator must inventory its own infrastructure providers, reverse proxy, hosting, PostgreSQL provider and any monitoring/logging services and assess applicable processor/transfer requirements.

## What this document does not claim

This document is not:

- a privacy policy presented to end users;
- a GDPR legal opinion;
- a DPIA;
- an ISO/IEC 27701 audit;
- an independent privacy audit.

It is an implementation-oriented privacy inventory and control description.
