# Data Inventory

**Assessment date:** 2026-08-26

This is an engineering inventory of data represented by the current database schema. Whether a field is personal data can depend on context, identifiability, deployment configuration and how the value is used. This document is therefore not a legal classification of every field.

| Entity/data | Purpose | Potential personal data | Retention currently defined in code | Access / notes |
|---|---|---|---|---|
| User username | Account identification | Yes, depending on value | Account lifetime | Auth/admin context |
| Password hash | Authentication | Security credential material | Account lifetime | Never intended for user/API exposure |
| Session | Authentication | Yes | Until expiry / cleanup | Server-side |
| Domain membership | Authorization | Yes, because it links a user to a domain | Membership lifetime | Domain authorization |
| API key hash/prefix | API authentication | Credential-related | Until expiry/revocation/deletion | Raw secret is not stored as the reusable key |
| API-key usage timestamp | Operational/security | Potentially | No complete retention policy yet | `lastUsedAt` |
| Audit actor pseudonym | Accountability | Potentially pseudonymous personal data | Enforced: 180 days, purged by the worker | Raw user ID deliberately absent |
| User audit salt | Audit pseudonymization | Security/personal-data related | User lifetime; deletion breaks historical linkage | Per-user secret |
| Audit API-key pseudonym | Accountability | Potentially pseudonymous | Same as audit actor pseudonym (180 days) | Correlation without raw key relation in entry |
| Short-link target URL | Redirect service | Not inherently; may contain personal data | Link record retained until manual deletion; `expiresAt` only stops public access | User/domain scoped |
| Link title/description/metadata | Preview | May contain personal data copied from target | Same as target URL (manual deletion only) | Derived from external target |
| Screenshot (landscape + portrait) | Preview | May contain arbitrary personal data visible on target page | Enforced: deleted at link expiry, at link deletion, and on re-render (old file replaced) | Persistent file storage; can be disabled per-link (`screenshotDisabled`) |
| Link visit event | Analytics | Potentially | Enforced: 90 days | Domain/link scoped |
| Visitor hash | Analytics | Potentially pseudonymous personal data | Same as link visit event | Scoped per short link (year + linkId + ip + userAgent), so it cannot correlate one visitor across different links |
| Daily statistics | Analytics | Usually aggregate; depends on inputs | No complete retention policy yet | Link scoped |
| Monthly HLL statistics | Analytics | Aggregate/approximate; depends on inputs | No complete retention policy yet | Link scoped |
| Link timestamps | Operations | Potentially contextual data | Link lifetime | Creation/update/click/fetch times |
| Job errors | Worker diagnostics | May contain target-specific information | No complete retention policy yet | Avoid secrets in errors |
| Link complaint | Abuse/quality reporting | Free-text message may contain personal data volunteered by the reporter | No complete retention policy yet | No reporter identifier stored; rate-limited per link+IP |
| Domain hostname | Service configuration | Usually organization/service data | Domain lifetime | May itself identify an organization/person |
| Domain settings | Service configuration | Depends on setting values | Domain lifetime | Operator-controlled; includes the default public-redirect delay |
| Rate-limit attempt state (`LoginAttempt`, `ApiRequestAttempt`) | Abuse prevention | Potentially, depending on key | Enforced: `LoginAttempt` at reset, `ApiRequestAttempt` 90 days after reset | Authentication/API infrastructure |

## Important privacy observations

### Visitor analytics

The current schema contains `LinkVisit.visitorHash`. A hash can still be personal data if the operator or another party can reasonably use it to single out or link a person. It should therefore be treated conservatively until the exact derivation and deployment context are assessed. The hash is derived per short link (year + link ID + IP + user agent), so it cannot be used on its own to correlate the same visitor's activity across different links or domains — it is scoped to "this visitor, this link", not "this visitor, this deployment".

### Screenshots

Screenshots are copies of remote web content, captured in both a landscape and a portrait variant and displayed on the public link-preview page. They may contain names, profile information, images, contact information or other personal data even when Shortcode Gen itself did not collect those fields directly. Because they carry that risk with no independent retention purpose of their own, the files (not just the database rows) are deleted automatically when the link expires, when the link is deleted, and are replaced in place on every re-render; an owner/admin can also disable capture for a given link entirely.

### Target URLs

The service cannot assume that a URL is non-personal. Query parameters, path components and fragments can contain identifiers or sensitive information.

### Audit pseudonymization

Audit records intentionally avoid storing a raw `userId`. The current implementation uses a per-user salt and HMAC-derived pseudonymization. Deleting the user salt is intended to permanently sever the historical link to that user's identity.

This reduces unnecessary identity exposure but does not make the audit record automatically anonymous while the mapping remains possible.

## Data-flow summary

```text
Administrator
   |
   +--> account/session data --> database
   |
   +--> target URL ------------> link database
                                  |
                                  +--> worker --> external target
                                  |                 |
                                  |                 +--> metadata
                                  |                 +--> screenshot
                                  |
                                  +--> public visitor --> analytics
                                  |
                                  +--> audit event --> pseudonymized audit log
```

## Missing operator decisions

The implementation still needs explicit deployment-level decisions for:

- daily/monthly aggregate statistics retention (raw visit events and screenshots now have enforced retention; the aggregates derived from them do not yet);
- expired-link record retention/deletion — expiry is a public-access cutoff only, not a deletion trigger; the link record itself stays until an admin deletes it manually;
- session cleanup for sessions that expire without an explicit logout;
- job/error-log retention;
- link-complaint retention;
- data-subject request handling;
- lawful bases for each processing purpose;
- whether a DPIA is required.

These should not be invented as universal software defaults when they depend on the operator's role and use case.
