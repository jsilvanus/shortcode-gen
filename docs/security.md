# Security

**Assessment date:** 2026-08-26

This is an engineering security overview of the current repository. It is not a penetration test, independent security audit, or certification.

## Security objectives

The service should preserve:

- confidentiality of administrative data and credentials;
- integrity of links, domains and authorization state;
- availability of the public redirect service;
- isolation between domains;
- safe handling of untrusted target URLs;
- safe handling of asynchronous browser/network work.

## Authentication

- Passwords are stored using Argon2 hashing.
- Sessions are persisted server-side.
- Login-attempt state is represented in the database.
- API keys are represented by a prefix and hash rather than storing a reusable plaintext secret.

## Authorization

Authorization is domain-aware. `DomainMembership` associates users with domains and roles. API keys are domain-scoped.

The principal security requirement is that every administrative/API/MCP operation resolve and enforce the correct domain context rather than trusting a client-supplied domain identifier.

This should remain an explicit regression-test category.

## Tenant isolation

The database schema associates links, collections, settings, API keys and audit records with a domain. This provides the structural basis for multi-tenant isolation.

Structural association is not sufficient by itself: application queries must consistently filter by the authorized domain context.

## API key security

API keys have:

- a label;
- a unique prefix;
- a hash;
- owner and domain association;
- optional expiration;
- revocation state;
- last-use tracking.

The raw key should only be presented to the user at creation time and should never be logged.

## SSRF

Metadata fetching is one of the most important security boundaries because administrators can supply arbitrary target URLs.

The URL-safety layer is intended to reject dangerous schemes and internal/private destinations and to revalidate redirects. DNS resolution and IPv4/IPv6 handling are therefore critical.

The same security model must be applied to Playwright. Browser rendering must not become a way to bypass the HTTP fetcher's SSRF controls.

Recommended regression cases include:

- localhost;
- loopback IPv4;
- loopback IPv6;
- RFC1918 ranges;
- link-local addresses;
- IPv4-mapped IPv6;
- DNS names resolving to private addresses;
- redirect to a private address;
- multi-hop redirect chains;
- unusual URL encodings;
- DNS rebinding scenarios;
- non-HTTP schemes.

## Resource limits

Outbound fetching and browser rendering must be constrained by:

- connection timeout;
- overall timeout;
- response-size limit;
- redirect limit;
- browser execution/resource limits where practical.

These controls protect both against SSRF and resource-exhaustion attacks.

## Browser rendering

Playwright handles untrusted remote content. The production container should therefore be treated as an isolated network/browser execution environment.

The production deployment should verify:

- browser sandbox expectations;
- container privileges;
- filesystem permissions;
- network egress restrictions;
- temporary file handling;
- screenshot storage permissions.

## Input validation

Zod and application-level validation are used for structured API input. URL and short-code validation have dedicated security logic.

All new API routes should validate both input syntax and authorization scope.

## Rate limiting

The schema contains separate login and API request attempt state. This provides a persistence mechanism for rate limiting.

The operational review should verify that every relevant endpoint actually invokes the appropriate limiter and that limits cannot be bypassed trivially through alternate authentication paths.

## Secrets

Secrets must be supplied through environment/deployment configuration and must not be committed to Git or embedded in Docker images.

Logs must not contain:

- passwords;
- password hashes;
- session tokens;
- API-key secrets;
- database credentials;
- authorization headers.

## Audit logging

The audit system intentionally avoids storing raw user IDs in audit entries. Actor pseudonyms are derived using a per-user salt and an HMAC secret.

Audit logging improves accountability but itself becomes security-sensitive data and requires access control and retention controls.

## Database security

Production uses PostgreSQL supplied by separate infrastructure. Database access should be private to the application infrastructure and should use credentials supplied through the deployment environment.

Schema changes should use migrations rather than uncontrolled schema push operations.

## Dependency security

The project uses current-generation Next.js, React, Prisma, Argon2, Playwright, Zod and related packages. Dependency versions should be reviewed regularly and CI should continue to run lockfile-based installs and tests.

A dependency review is still required before calling the system security-reviewed.

## Container security

The production container should be reviewed for:

- non-root execution where practical;
- minimal filesystem write access;
- persistent screenshot directory permissions;
- no unnecessary exposed ports;
- no secrets baked into the image;
- current base image and browser dependencies.

## Backups and recovery

Database backup/recovery is delegated to the separate PostgreSQL project in the production architecture.

This means Shortcode Gen's security documentation must distinguish application controls from infrastructure controls. A deployment is not operationally resilient merely because the application can connect to PostgreSQL.

A restore test remains a required operational verification item.

## Incident response

A formal incident-response procedure is not yet part of the repository documentation. This should cover:

1. detection;
2. containment;
3. credential/API-key revocation;
4. evidence preservation;
5. notification assessment;
6. recovery;
7. post-incident review.

## Security status

The project contains meaningful security controls, but there has not been an independent penetration test or formal ISO certification recorded in the repository.

The appropriate statement is therefore:

> Security controls are implemented and documented at an engineering level; formal independent security assurance has not been completed.
