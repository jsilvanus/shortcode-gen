# Shortcode Gen Architecture

**Status:** current implementation overview  
**Assessment date:** 2026-08-26  
**Repository:** `jsilvanus/shortcode-gen` (`main`)

## 1. Purpose

Shortcode Gen is a self-hosted, multi-domain short-link service. It creates short URLs, optionally using human-readable aliases, and provides an administration UI, API access, asynchronous metadata/rendering work, QR codes, analytics, collections, audit logging, and MCP access.

The project is intentionally self-hostable. Local development uses SQLite; staging and production use PostgreSQL.

## 2. High-level architecture

```text
                    Internet
                       |
                reverse proxy / TLS
                       |
                 Next.js application
                 /       |        \
                /        |         \
          public links   API       admin UI
                |         |          |
                +---------+----------+
                          |
                       Prisma
                          |
                     PostgreSQL
                    (SQLite locally)
                          |
                    database jobs
                          |
                     worker process
                    /             \
             HTTP metadata      Playwright
             fetching            rendering
                                  |
                              screenshots
```

The database is the source of truth for links, users, domains, jobs, audit records, analytics and configuration. Background work is represented by database jobs rather than requiring Redis.

## 3. Application components

### Web application

The Next.js App Router application provides:

- public short-link handling;
- administrator authentication and UI;
- domain administration;
- user/domain membership administration;
- link management;
- collections;
- API routes;
- API-key management;
- audit-log access;
- QR generation;
- MCP transport;
- health endpoint.

### Worker

The worker processes asynchronous jobs, notably metadata fetching/rendering and related maintenance. Jobs remain in the database so that a lost wake-up does not lose work.

### Database

Prisma is used as the persistence layer. There are separate SQLite and PostgreSQL schemas/migration histories.

### Persistent files

Screenshots and related rendered assets require persistent storage in containerized deployments.

## 4. Multi-domain model

A `Domain` is the primary tenant boundary. A domain has:

- a hostname;
- optional aliases;
- active/inactive state;
- memberships;
- links;
- collections;
- settings;
- API keys;
- audit-log entries.

`DomainAlias` maps additional hostnames to the same domain. Links therefore remain associated with the domain rather than with an individual hostname alias.

`DomainMembership` assigns a user a role for a particular domain. The domain membership role is authoritative for domain access; the global user role is not intended to bypass domain membership checks.

## 5. Data model

The current Prisma model contains at least the following major entities:

- `User` — account and authentication data;
- `Domain` — managed tenant/domain;
- `DomainAlias` — alternate hostname;
- `DomainMembership` — user/domain authorization;
- `Session` — server-side login session;
- `LoginAttempt` — login rate limiting state;
- `ApiKey` — domain-scoped API credentials;
- `ApiRequestAttempt` — API-key rate limiting state;
- `UserAuditSalt` — per-user audit pseudonymization secret;
- `AuditLogEntry` — pseudonymized audit trail;
- `ShortLink` — short URL and metadata/rendering state;
- `Collection` / `LinkCollection` — link grouping;
- `DomainSetting` / `SiteSetting` — configuration;
- `Job` — asynchronous work;
- `LinkVisit` — visit/analytics event data;
- `LinkDailyStat` / `LinkMonthlyStat` — aggregated analytics.

The schema enforces domain/code uniqueness and has indexes for common domain, ownership, expiry, rendering and analytics queries.

## 6. Short codes

Generated codes use a human-friendly, case-insensitive alphabet:

```text
0123456789ACDEFHJKMNPQRTUVWXY
```

Human-written codes support letters, numbers, `-`, and `_`. Codes are treated case-insensitively.

Public short links are root-level paths, while technical paths such as `/admin`, `/api`, and `/health` are reserved.

## 7. Authentication and authorization

Passwords are hashed with Argon2. Sessions are persisted server-side. API keys are stored as hashes rather than as reusable plaintext credentials.

Authorization is domain-aware. A user's membership determines their access to a domain. API keys are associated with both a domain and an owner.

Administrative bootstrap operations, such as creating a domain and assigning its first administrator, are intentionally supported by CLI scripts rather than requiring an already-administered web domain.

## 8. Link lifecycle

A link contains its destination and optional metadata/rendering state. Links can be private, active/inactive and optionally expire.

The public lookup path checks link state and expiration rather than relying on a maintenance job to deactivate links at exactly the expiration time.

Metadata and rendering are asynchronous. A link can therefore exist before its preview data has been fetched.

## 9. Metadata and rendering

The project contains normal HTTP metadata fetching and Playwright-based rendering. The design is to use ordinary HTTP fetching first and browser rendering when necessary.

The link model records metadata such as title, description, canonical URL, image/favicon URLs, content hash, ETag/Last-Modified information and rendering status. This permits refresh work without making public redirect requests perform expensive browser operations.

## 10. SSRF boundary

Fetching administrator-supplied target URLs is a security-sensitive operation. URL safety code exists to restrict dangerous destinations and redirect behaviour. Browser rendering must be treated as part of the same untrusted-network boundary.

This area is explicitly part of the security assessment and should receive regression tests whenever the fetch/render architecture changes.

## 11. Analytics

The current model goes beyond the original minimal click counter. It contains visit events and daily/monthly aggregate statistics, including pseudonymous visitor hashes and approximate unique-count structures.

Because analytics can constitute personal-data processing depending on the deployment and hashing inputs, it is covered by the privacy documentation rather than being treated as automatically anonymous.

## 12. Audit logging

Audit entries intentionally do not store a raw user ID. The implementation uses a per-user salt and an HMAC-derived actor pseudonym. Deleting the user's salt is designed to make the historical association with that user permanently unrecoverable.

API-key activity can additionally be correlated using an API-key pseudonym without exposing the raw API-key relationship in the audit entry.

This is a privacy-by-design measure, but it is not by itself proof of GDPR compliance.

## 13. API and MCP

The repository contains API-key management and API routes for application access. It also contains an MCP endpoint/server implementation.

The API and MCP interfaces are separate access surfaces and must obey the same domain authorization and data-protection expectations as the web UI.

## 14. QR codes

QR generation is implemented through a QR library, a QR helper and a link-specific API route. Tests exist for QR functionality.

## 15. Deployment

### Local

```text
Node.js / Next.js
        |
      SQLite
```

Docker is not required for local development.

### Staging

The repository contains a staging Compose configuration using PostgreSQL and a reverse-proxy setup.

### Production

The repository contains a production Compose configuration intended to run the application while PostgreSQL is supplied by the separate PostgreSQL project. Traefik is the intended production reverse proxy.

The exact operational deployment procedure should be kept in `operations.md` and verified against the deployment files whenever they change.

## 16. Security boundaries

The most important boundaries are:

1. public visitor -> short-link endpoint;
2. administrator -> authenticated application;
3. API client -> API key authentication;
4. MCP client -> MCP authentication/authorization;
5. application -> database;
6. application/worker -> arbitrary Internet targets;
7. Playwright -> arbitrary Internet targets;
8. application container -> persistent screenshot storage;
9. domain A -> domain B tenant isolation.

## 17. Current architectural limitations

The architecture is implemented substantially but should not be described as formally security-audited, privacy-audited, ISO-certified, or penetration-tested.

Operational guarantees such as backup/restore, host hardening, network policy, TLS configuration, filesystem permissions and incident response depend partly on the deployment environment and the separate PostgreSQL infrastructure.

See:

- `features.md` — implementation inventory;
- `roadmap.md` — remaining work;
- `privacy.md` — data-processing assessment;
- `security.md` — security assessment;
- `privacy-security-assessment.md` — standards-oriented self-assessment;
- `operations.md` — deployment/operations guidance.
