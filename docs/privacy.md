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

The worker fetches administrator-supplied URLs and may render them with a browser. This can copy information from third-party pages into metadata fields or screenshots. Operators should therefore treat the metadata/rendering pipeline as a data-processing boundary.

### Analytics

The current implementation includes visit events, visitor hashes and aggregate daily/monthly statistics. These are potentially personal-data processing activities and require an explicit deployment-level retention and lawful-basis assessment.

A hash is not automatically anonymous simply because the original identifier is not stored in clear text.

### Audit logging

Audit records are designed to avoid storing raw user IDs. The implementation derives an actor pseudonym from a per-user salt and an HMAC secret. API-key events can receive a separate pseudonym.

The user's audit salt is deleted with the user, intentionally preventing future reconstruction of the identity association for historical entries.

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
- audit logs;
- API keys;
- visit events;
- aggregate statistics;
- screenshots;
- metadata;
- expired links;
- failed/completed jobs.

Retention must be based on purpose and legal/operational requirements rather than simply keeping everything indefinitely.

## Deletion

Deletion of a user cascades to the user's audit salt. This is an intentional crypto-shredding mechanism for historical actor linkage.

Domain/link deletion also uses database relationships with cascading behaviour in relevant models. Operators still need to consider persistent files such as screenshots and backups when implementing complete deletion workflows.

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
