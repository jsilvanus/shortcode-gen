# Data Inventory

**Assessment date:** 2026-08-26

This is an engineering inventory of data represented by the current database schema. Whether a field is personal data can depend on context, identifiability, deployment configuration and how the value is used. This document is therefore not a legal classification of every field.

| Entity/data | Purpose | Potential personal data | Retention currently defined in code | Access / notes |
|---|---|---|---|---|
| User username | Account identification | Yes, depending on value | Account lifetime | Auth/admin context |
| Password hash | Authentication | Security credential material | Account lifetime | Never intended for user/API exposure |
| Session | Authentication | Yes | Until expiry / cleanup | Server-side |
| Login attempt state | Abuse prevention | Potentially, depending on key | Reset window | Authentication infrastructure |
| Domain membership | Authorization | Yes, because it links a user to a domain | Membership lifetime | Domain authorization |
| API key hash/prefix | API authentication | Credential-related | Until expiry/revocation/deletion | Raw secret is not stored as the reusable key |
| API-key usage timestamp | Operational/security | Potentially | No complete retention policy yet | `lastUsedAt` |
| Audit actor pseudonym | Accountability | Potentially pseudonymous personal data | No complete retention policy yet | Raw user ID deliberately absent |
| User audit salt | Audit pseudonymization | Security/personal-data related | User lifetime; deletion breaks historical linkage | Per-user secret |
| Audit API-key pseudonym | Accountability | Potentially pseudonymous | No complete retention policy yet | Correlation without raw key relation in entry |
| Short-link target URL | Redirect service | Not inherently; may contain personal data | Link lifetime | User/domain scoped |
| Link title/description/metadata | Preview | May contain personal data copied from target | Link lifetime | Derived from external target |
| Screenshot | Preview | May contain arbitrary personal data visible on target page | Link lifetime unless separately retained | Persistent file storage |
| Link visit event | Analytics | Potentially | No complete retention policy yet | Domain/link scoped |
| Visitor hash | Analytics | Potentially pseudonymous personal data | No complete retention policy yet | Hashing does not automatically make data anonymous |
| Daily statistics | Analytics | Usually aggregate; depends on inputs | No complete retention policy yet | Link scoped |
| Monthly HLL statistics | Analytics | Aggregate/approximate; depends on inputs | No complete retention policy yet | Link scoped |
| Link timestamps | Operations | Potentially contextual data | Link lifetime | Creation/update/click/fetch times |
| Job errors | Worker diagnostics | May contain target-specific information | No complete retention policy yet | Avoid secrets in errors |
| Domain hostname | Service configuration | Usually organization/service data | Domain lifetime | May itself identify an organization/person |
| Domain settings | Service configuration | Depends on setting values | Domain lifetime | Operator-controlled |

## Important privacy observations

### Visitor analytics

The current schema contains `LinkVisit.visitorHash`. A hash can still be personal data if the operator or another party can reasonably use it to single out or link a person. It should therefore be treated conservatively until the exact derivation and deployment context are assessed.

### Screenshots

Screenshots are copies of remote web content. They may contain names, profile information, images, contact information or other personal data even when Shortcode Gen itself did not collect those fields directly.

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

- analytics retention;
- audit-log retention;
- screenshot retention;
- expired-link retention/deletion;
- session cleanup;
- job/error-log retention;
- data-subject request handling;
- lawful bases for each processing purpose;
- whether a DPIA is required.

These should not be invented as universal software defaults when they depend on the operator's role and use case.
