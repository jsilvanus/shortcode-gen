# Shortcode Gen Feature Inventory

**Assessment date:** 2026-08-26  
**Basis:** implementation on `main`, not historical plans.

Status values mean:

- **Implemented** — code exists for the feature.
- **Partial** — significant implementation exists, but coverage or operational completion still needs verification.
- **Planned** — described as future work and not implemented as a complete feature.
- **Unknown** — documentation/code review has not established enough evidence.

## Core service

| Feature | Status | Notes |
|---|---|---|
| Short-link creation | Implemented | Persistent `ShortLink` model and admin/API surfaces exist. |
| Short-link lookup | Implemented | Root-level `/:code` route exists. |
| Generated codes | Implemented | Human-friendly alphabet. |
| Custom/human-readable codes | Implemented | Case-insensitive validation/normalization. |
| Reserved application routes | Implemented | Application routes are kept out of the short-code namespace. |
| Link activation/deactivation | Implemented | `active` state exists. |
| Link expiration | Implemented | `expiresAt` exists and is part of link lifecycle. |
| Link metadata | Implemented | Title, description, canonical/image/favicon fields exist. |
| Link ownership | Implemented | Links belong to a user and domain. |

## Multi-domain

| Feature | Status | Notes |
|---|---|---|
| Managed domains | Implemented | `Domain` model and admin UI/API. |
| Domain aliases | Implemented | `DomainAlias` and alias administration exist. |
| Domain memberships | Implemented | Per-domain user membership model. |
| Domain roles | Implemented | Membership role is used for domain administration. |
| CLI domain creation | Implemented | `scripts/domain.ts`. |
| CLI first-admin assignment | Implemented | Domain admin add/list/remove commands. |
| Domain settings | Implemented | Domain setting model/UI/API exist. |
| Cross-domain isolation | Implemented in architecture | Must remain a security regression-test target. |

## Authentication and authorization

| Feature | Status | Notes |
|---|---|---|
| Password authentication | Implemented | Argon2 dependency and password hashes. |
| Server-side sessions | Implemented | `Session` model. |
| Login attempt limiting | Implemented | `LoginAttempt` model. |
| Domain-aware authorization | Implemented | Membership model and domain context. |
| User administration | Implemented | Admin UI/API and CLI user creation. |
| API keys | Implemented | Hashed keys, prefix, expiry and revocation state. |
| API-key rate limiting | Implemented | `ApiRequestAttempt`. |

## Collections

| Feature | Status | Notes |
|---|---|---|
| Collections | Implemented | Domain-scoped `Collection`. |
| Link/collection membership | Implemented | `LinkCollection`. |
| Private collections | Implemented | `isPrivate`. |
| Collection API | Implemented | API routes exist. |

## Metadata and rendering

| Feature | Status | Notes |
|---|---|---|
| Background jobs | Implemented | Database-backed `Job`. |
| Metadata fetching | Implemented | Worker infrastructure exists. |
| Metadata refresh state | Implemented | Fetch timestamps/hash/ETag/Last-Modified fields. |
| Playwright rendering | Implemented | Dependency and rendering state exist. |
| Screenshot persistence | Implemented | Screenshot path/state exists; deployment persistence still needs operational verification. |
| Render retry/state | Implemented | Job/render status fields exist. |
| SSRF protection | Implemented | URL safety implementation exists; continue testing as a security boundary. |

## QR

| Feature | Status | Notes |
|---|---|---|
| QR generation | Implemented | QR helper and link QR route exist. |
| QR tests | Implemented | Dedicated test exists. |

## Analytics

| Feature | Status | Notes |
|---|---|---|
| Click counters | Implemented | `clickCount`, `lastClickedAt`. |
| Visit events | Implemented | `LinkVisit`. |
| Visitor pseudonym/hash | Implemented | `visitorHash` field. |
| Daily statistics | Implemented | `LinkDailyStat`. |
| Monthly statistics | Implemented | `LinkMonthlyStat`. |
| Approximate unique counts | Implemented | HLL fields in monthly statistics. |
| Privacy assessment of analytics | Partial | Technical mechanism exists; deployment-specific lawful basis/retention still requires an operator decision. |

## Audit and privacy

| Feature | Status | Notes |
|---|---|---|
| Audit log | Implemented | Domain-scoped audit entries. |
| Pseudonymized actor identity | Implemented | Per-user salt + HMAC design. |
| API-key pseudonymization | Implemented | Separate audit pseudonym. |
| Crypto-shredding on user deletion | Implemented by design | User salt cascades with user deletion. |
| Formal GDPR assessment | Not implemented | This documentation pass starts the engineering assessment; it is not a legal audit. |
| Formal ISO audit/certification | Not implemented | No formal certification is claimed. |

## API / MCP

| Feature | Status | Notes |
|---|---|---|
| API routes | Implemented | Multiple resource APIs exist. |
| API-key management UI/API | Implemented | Create/list/revoke/expiry model. |
| MCP endpoint | Implemented | MCP route exists. |
| MCP server implementation | Implemented | Dedicated MCP server module exists. |
| Complete public API specification | Partial | Implementation exists; consolidated API reference documentation is still being created. |
| Complete MCP reference | Partial | Implementation exists; dedicated documentation is still being created. |

## Deployment

| Feature | Status | Notes |
|---|---|---|
| Docker image | Implemented | `Dockerfile`. |
| Production Compose | Implemented | Repository contains production Compose configuration. |
| Staging Compose | Implemented | Repository contains staging Compose configuration. |
| PostgreSQL schema | Implemented | Separate Prisma PostgreSQL schema/migrations. |
| SQLite schema | Implemented | Local Prisma schema/migrations. |
| CI | Implemented | GitHub Actions workflow exists. |
| Production backup system | External dependency | PostgreSQL project is responsible for DB backups. |
| Formal disaster-recovery test | Unknown | Requires operational verification. |
| Formal penetration test | Not implemented | No evidence of independent pentest in repository. |
| ISO certification | Not implemented | No certification is claimed. |

## Documentation

| Document | Status |
|---|---|
| Original technical plan | Historical; preserved as `first-plan.md` |
| Current architecture | Implemented in this documentation pass |
| Feature inventory | Implemented in this documentation pass |
| Roadmap | Implemented in this documentation pass |
| Privacy/data inventory | In progress in this documentation pass |
| Security assessment | In progress in this documentation pass |
| Standards self-assessment | In progress in this documentation pass |
| Operations guide | In progress in this documentation pass |
| API reference | In progress in this documentation pass |
| MCP reference | In progress in this documentation pass |
