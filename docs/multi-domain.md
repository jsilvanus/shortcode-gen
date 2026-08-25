# Multi-Domain Architecture Plan

## Goal

Shortcode Gen should support multiple managed public hostnames from one application/database deployment. A managed domain may have one or more **aliases**. Aliases are additional public hostnames for the same domain and therefore share the same users, settings, links, collections, and short codes.

Examples:

```text
Canonical domain: short.riksunsrk.fi
Alias:            short.riihimaenseurakunta.fi

short.riksunsrk.fi/kirkko
short.riihimaenseurakunta.fi/kirkko
```

Both URLs resolve to the same `Domain` and therefore the same `ShortLink`.

## Core model

```text
System Admin
     |
     v
  Domain
  /  |  \
 /   |   \
Users Links Settings
     |
   Aliases
  /      \
Host A  Host B
```

### Domain

```text
Domain
------
id
hostname          # canonical hostname
name
active
createdAt
updatedAt
```

`hostname` is normalized and unique. It is the canonical public hostname for the domain.

### Domain alias

```text
DomainAlias
-----------
id
domainId
hostname
active
createdAt
updatedAt
```

`hostname` is globally unique among aliases. An alias must not also be the canonical hostname of another domain.

Aliases are not separate domains. They are alternate hostnames for the same domain boundary.

### Domain membership

```text
DomainMembership
----------------
domainId
userId
role
createdAt
updatedAt
```

Roles:

- `USER`: normal member of the domain.
- `ADMIN`: administrator for the domain.

Users remain global accounts. A user can have different roles on different domains.

A separate system-level administrator role may manage domains globally.

## Domain resolution

The incoming hostname resolves to a canonical `Domain` in either of two ways:

```text
short.riksunsrk.fi
        |
        v
Domain.hostname
        |
        v
Domain A
```

or:

```text
short.riihimaenseurakunta.fi
        |
        v
DomainAlias.hostname
        |
        v
Domain A
```

After resolution, the application uses the canonical `domainId` for all authorization and data access.

This is the key distinction:

> Hostnames identify how a request arrived; `Domain` identifies the tenant/data boundary.

Therefore aliases must never create duplicate links or memberships.

## Links

`ShortLink` is scoped to the canonical `Domain`:

```text
ShortLink
---------
domainId
ownerId
code
...
```

The database uniqueness constraint is:

```text
@@unique([domainId, code])
```

This means:

```text
short.riksunsrk.fi/kirkko
short.riihimaenseurakunta.fi/kirkko
```

resolve to the **same** link, while:

```text
short.otherdomain.fi/kirkko
```

can independently have another link.

The existing case-insensitive canonical code rules remain unchanged.

## Public request resolution

The public route remains root-level:

```text
GET /:code
```

The request flow becomes:

```text
Host: short.riihimaenseurakunta.fi
        |
        v
normalize hostname
        |
        v
resolve DomainAlias
        |
        v
canonical Domain A
        |
        v
resolve ShortLink by (domainId, code)
        |
        v
serve interstitial / redirect
```

Create a central domain-context helper rather than reading `Host` independently throughout the application.

Suggested responsibilities:

- normalize the request hostname;
- resolve either `Domain.hostname` or `DomainAlias.hostname`;
- reject inactive domains and inactive aliases;
- resolve the authenticated user when present;
- resolve the user's `DomainMembership` against the canonical domain;
- expose the effective domain role.

Unknown hostnames must not serve links.

An inactive canonical domain makes all of its aliases inactive for practical purposes. An individual alias can also be disabled without disabling the canonical domain or its other aliases.

## Authorization

Authorization is scoped to the canonical domain, never to the hostname/alias.

### System administrator

Can:

- create/edit/deactivate domains;
- add/remove aliases;
- manage domain memberships;
- manage all domain settings and links.

### Domain administrator

Can, within their domain:

- manage domain settings;
- manage aliases;
- manage users/memberships;
- view all links, including private links;
- create/edit/deactivate/delete links;
- manage domain collections.

### Domain user

Can, within domains where they are a member:

- create links;
- view their own links;
- edit/deactivate/delete their own links;
- view other users' non-private links.

A non-private link does not grant edit permission.

Authorization helpers should be centralized, for example:

```text
canAccessDomain(user, domain)
canManageDomain(user, domain)
canManageUsers(user, domain)
canCreateLink(user, domain)
canEditLink(user, link)
canDeleteLink(user, link)
```

There should be no separate `canAccessAlias` permission: access to an alias follows access to its canonical domain.

## Settings

The current global `SiteSetting` model should be replaced or migrated to domain-scoped settings for settings that belong to a public hostname.

Domain settings should include the current site-level concepts where appropriate:

- site name/description;
- canonical public URL/hostname metadata;
- allowed target domains;
- default privacy;
- default/max TTL;
- custom-code policy;
- privacy information;
- analytics settings;
- appearance/branding.

Aliases should inherit all domain settings. There should be no duplicate settings per alias.

The existing `allowedDomains` setting must be understood and documented as **allowed target domains**. It is distinct from managed public domains and aliases.

Target-domain allow-listing does not replace SSRF protection. Every outbound metadata/screenshot request must continue to pass the SSRF/network safety checks.

## Collections

Collections are domain-scoped and therefore shared across all aliases of that domain:

```text
Collection
----------
id
domainId
ownerId
name
...
```

For the initial multi-domain implementation, collections must not span canonical domains.

## Management UI

The admin UI should operate in a current-domain context.

Example:

```text
Shortcode Gen

Domain
[ short.riksunsrk.fi v ]

Aliases
  short.riksunsrk.fi       canonical
  short.riihimaenseurakunta.fi

Links
Users
Settings
```

The domain selector lists canonical domains, not aliases. An alias is managed from the canonical domain's administration area.

Users with only one domain do not need to interact with a domain selector.

Users with multiple domains can switch context. All pages, queries, mutations, settings, users, collections, and links then operate on the selected/current canonical domain.

## API design

Existing link APIs remain structurally similar:

```text
POST   /api/links
GET    /api/links
GET    /api/links/:id
PATCH  /api/links/:id
DELETE /api/links/:id
```

The current canonical domain is derived from request hostname. A client-provided `domainId` must never override that context.

Domain administration should expose aliases separately, for example:

```text
/api/admin/domains
/api/admin/domains/:id
/api/admin/domains/:id/users
/api/admin/domains/:id/aliases
```

Creating an alias requires domain-management authorization. The server must normalize the hostname and reject it if it is already a canonical domain or alias.

## Domain lifecycle

Domains have an `active` state.

Deactivating a domain must stop all of its public links from being served through both the canonical hostname and every alias while preserving the database records.

Aliases also have an `active` state. Deactivating one alias only disables that hostname; the canonical hostname and other aliases continue to work.

Deleting an alias must never delete links, users, settings, or the canonical domain.

Deleting a domain should be conservative. A domain with links or memberships should not be silently deleted. Prefer an explicit migration/archive workflow if deletion is eventually required.

## Traefik

Production topology:

```text
Internet
   |
   v
Traefik
   |
   v
shortcode-web
   |
   +---- PostgreSQL
   |
   +---- shortcode-worker
```

Traefik routes the canonical hostname and all aliases to the same Next.js application and handles HTTPS certificates.

The application should not require a separate deployment/container per hostname.

Every alias must also have working DNS and TLS configuration. Registering an alias in the application database alone does not make the hostname reachable.

The deployment documentation must distinguish:

1. canonical domains in the application;
2. aliases in the application;
3. DNS records;
4. Traefik routing/TLS configuration.

For the initial implementation, keep production Traefik configuration explicit and predictable. Dynamic arbitrary-host provisioning can be considered later.

## Migration strategy

The existing single-domain installation must migrate without losing links.

Recommended sequence:

1. Add `Domain`.
2. Add `DomainAlias`.
3. Add `DomainMembership`.
4. Add nullable `domainId` to `ShortLink`.
5. Create the initial canonical domain from the configured public URL/hostname.
6. Attach existing links to that domain.
7. Create the appropriate membership for the existing administrator.
8. Add domain-scoped uniqueness/indexes.
9. Make `ShortLink.domainId` required.
10. Change all link queries and mutations to use canonical domain context.
11. Migrate site settings to domain settings.
12. Update collections to be domain-scoped.
13. Remove obsolete global-domain assumptions.

Existing alternate hostnames can then be added as aliases to the initial domain without changing any links or codes.

Production schema changes must use Prisma migrations and `prisma migrate deploy`.

## Security requirements

Test domain and alias isolation explicitly.

At minimum:

- a user belonging only to domain A cannot read domain B links;
- a user cannot edit/delete domain B links;
- a domain admin cannot administer another domain;
- aliases do not create a separate authorization boundary;
- an alias cannot be used to access another domain by manipulating IDs;
- a submitted `domainId` cannot override hostname/domain authorization;
- identical codes on different canonical domains are independent;
- identical codes through aliases of one domain resolve to the same link;
- inactive domains do not serve links through any hostname;
- inactive aliases do not serve links through that alias;
- public hostname lookup cannot be bypassed to access another domain's link;
- target-domain allow-listing remains separate from SSRF protection.

## Testing

### Unit

- hostname normalization;
- canonical hostname/domain matching;
- alias hostname/domain matching;
- inactive alias handling;
- domain context resolution;
- membership role checks;
- domain-scoped link lookup;
- domain-scoped code uniqueness.

### Integration

- create domain;
- add/remove alias;
- reject alias that is already a canonical hostname;
- reject duplicate aliases;
- add/remove membership;
- role changes;
- create link in current domain;
- duplicate code within a domain rejected;
- same code across canonical domains accepted;
- same code through aliases resolves to the same link;
- cross-domain API access rejected;
- domain settings isolation;
- inactive domain rejected;
- inactive alias rejected while canonical hostname remains functional.

### E2E

Test one canonical domain and one alias against the same deployment:

```text
short.riksunsrk.fi/test
short.riihimaenseurakunta.fi/test
```

Both must resolve to the same link.

Then test a second canonical domain using the same code:

```text
short.otherdomain.fi/test
```

It must resolve independently.

Also test alias management and role-specific administration UI.

## Implementation order

1. Prisma schema and migration.
2. Domain/alias normalization and resolution service.
3. Domain membership and authorization.
4. Domain-scoped link service and public lookup.
5. Domain-scoped settings.
6. Domain-scoped collections.
7. Admin/domain/alias management APIs.
8. Domain-aware dashboard and selector.
9. Traefik/DNS deployment documentation.
10. Isolation, alias-equivalence, and multi-domain E2E tests.
11. Migration verification against an existing database.

## Non-goals for the first implementation

- separate deployments per domain or alias;
- cross-domain collections;
- arbitrary dynamic Traefik configuration from the web UI;
- cross-domain user roles;
- trusting a client-supplied domain identifier for authorization.
