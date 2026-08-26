# API Reference

This document is a current-implementation reference. It is intentionally conservative: routes should only be documented as supported once their implementation and authorization behaviour have been verified.

## Authentication

Browser administration uses the application's server-side session authentication.

Programmatic access uses domain-scoped API keys where supported. API keys have a label, prefix, hash, optional expiration and revocation state.

## Resource groups currently present

### Links

The repository contains API routes for creating, listing, retrieving/updating/deleting links and link-related operations. Link operations are domain/ownership aware.

### Collections

Collection API routes provide domain-scoped collections and their link relationships.

### Domains and domain administration

Administrative API routes exist for domains, aliases and domain users/memberships.

### Settings

Administrative settings routes exist for application/domain configuration.

### API keys

API-key routes support management of API credentials. The secret is not intended to be stored as plaintext.

### Audit log

An audit-log API exists for authorized administrative inspection, including member-related audit access.

### QR

A link-specific QR endpoint exists for generating QR representations of short links.

### Health

A health endpoint exists for operational checks.

## Authorization rule

API documentation must always be read together with the domain authorization model. A valid authenticated session or API key is not sufficient by itself: the principal must be authorized for the relevant domain/resource.

## Error handling

Clients should treat non-2xx responses as failures and should not assume that a resource exists merely because a syntactically valid identifier was supplied. Authorization failures should not leak cross-domain resource existence.

## API evolution

The implementation should be considered the source of truth for route details until a generated OpenAPI-style specification is introduced.

A future API documentation pass should enumerate every route with:

- method;
- path;
- authentication;
- authorization scope;
- request schema;
- response schema;
- error responses;
- examples;
- rate limits.
