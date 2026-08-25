# Multi-Domain Architecture Plan

## Goal

Shortcode Gen should support multiple managed public hostnames from one application/database deployment.

Examples:

```text
short.abc.com
short.dec.com
links.example.fi
```

Each hostname is a first-class domain boundary. Users may belong to multiple domains, with a role per domain. Links, collections, settings, and management operations are scoped to a domain.

The hostname from the incoming request determines the domain context. Clients must not be able to select another domain merely by submitting a different `domainId` in an API request.

## Core model

```text
System Admin
     |
     v
  Domain
  /  |  \
 /   |   \
Users Links Settings
```

### Domain

```text
Domain
------
id
hostname
name
active
createdAt
updatedAt
```

`hostname` is normalized and unique. It represents a managed public hostname, not a link target allow-list entry.

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
- `ADMIN`: administrator for that domain.

Users remain global accounts. A user can have different roles on different domains.

A separate system-level administrator role may manage domains globally.

## Links

`ShortLink` becomes domain-scoped:

```text
ShortLink
---------
domainId
ownerId
code
...
```

The database uniqueness constraint becomes:

```text
@@unique([domainId, code])
```

This allows the same code to exist on different domains:

```text
short.abc.com/kirkko
short.dec.com/kirkko
```

They are independent links.

The existing case-insensitive canonical code rules remain unchanged.

## Public request resolution

The public route remains root-level:

```text
GET /:code
```

The request flow becomes:

```text
Host: short.abc.com
        |
        v
normalize hostname
        |
        v
resolve Domain
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
- resolve the active `Domain`;
- resolve the authenticated user when present;
- resolve the user's `DomainMembership`;
- expose the effective domain role.

Unknown or inactive public domains must not serve links.

## Authorization

Authorization is domain-scoped and must be enforced server-side.

### System administrator

Can:

- create/edit/deactivate domains;
- manage domain memberships;
- manage all domain settings and links.

### Domain administrator

Can, within their domain:

- manage domain settings;
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

## Settings

The current global `SiteSetting` model should be replaced or migrated to domain-scoped settings for settings that belong to a public hostname.

Domain settings should include the current site-level concepts where appropriate:

- site name/description;
- public URL/hostname metadata;
- allowed target domains;
- default privacy;
- default/max TTL;
- custom-code policy;
- privacy information;
- analytics settings;
- appearance/branding.

The existing `allowedDomains` setting must be understood and documented as **allowed target domains**. It is distinct from managed public domains.

Target-domain allow-listing does not replace SSRF protection. Every outbound metadata/screenshot request must continue to pass the SSRF/network safety checks.

## Collections

Collections should also be domain-scoped:

```text
Collection
----------
id
domainId
ownerId
name
...
```

For the initial multi-domain implementation, collections must not span domains.

## Management UI

The admin UI should operate in a current-domain context.

Example:

```text
Shortcode Gen

Domain
[ short.abc.com v ]

Links
Users
Settings
```

Users with only one domain do not need to interact with a selector.

Users with multiple domains can switch context. All pages, queries, mutations, settings, users, collections, and links then operate on the selected/current domain.

The frontend must not be treated as the authorization boundary. APIs resolve and authorize the domain independently.

## API design

Existing link APIs remain structurally similar:

```text
POST   /api/links
GET    /api/links
GET    /api/links/:id
PATCH  /api/links/:id
DELETE /api/links/:id
```

The current domain is derived from the request context rather than trusted from a client-provided `domainId`.

System-level domain administration can use dedicated APIs, for example:

```text
/api/admin/domains
/api/admin/domains/:id
/api/admin/domains/:id/users
```

Domain-admin APIs must verify that the authenticated user administers the requested domain.

## Domain lifecycle

Domains have an `active` state.

Deactivating a domain must stop its public links from being served while preserving its database records, users, settings, and links.

Deletion should be conservative. A domain with links or memberships should not be silently deleted. Prefer an explicit migration/archive workflow if deletion is eventually required.

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

Traefik routes all managed hostnames to the same Next.js application and handles HTTPS certificates.

The application should not require a separate deployment/container per domain.

The deployment documentation must distinguish:

1. a hostname being registered as a `Domain` in the database; and
2. that hostname being accepted by Traefik/DNS/TLS infrastructure.

For the initial implementation, keep production Traefik configuration explicit and predictable. Dynamic arbitrary-domain provisioning can be considered later.

## Migration strategy

The existing single-domain installation must migrate without losing links.

Recommended sequence:

1. Add `Domain`.
2. Add `DomainMembership`.
3. Add nullable `domainId` to `ShortLink`.
4. Create the initial domain from the configured public URL/hostname.
5. Attach existing links to that domain.
6. Create the appropriate membership for the existing administrator.
7. Add domain-scoped uniqueness/indexes.
8. Make `ShortLink.domainId` required.
9. Change all link queries and mutations to use domain context.
10. Migrate site settings to domain settings.
11. Update collections to be domain-scoped.
12. Remove obsolete global-domain assumptions.

Production schema changes must use Prisma migrations and `prisma migrate deploy`.

## Security requirements

Test domain isolation explicitly.

At minimum:

- a user belonging only to domain A cannot read domain B links;
- a user cannot edit/delete domain B links;
- a domain admin cannot administer another domain;
- domain settings cannot be read/modified cross-domain;
- users/memberships cannot be administered cross-domain;
- a submitted `domainId` cannot override hostname/domain authorization;
- identical codes on different domains resolve independently;
- inactive domains do not serve links;
- public hostname lookup cannot be bypassed to access another domain's link;
- target-domain allow-listing remains separate from SSRF protection.

## Testing

### Unit

- hostname normalization;
- hostname/domain matching;
- domain context resolution;
- membership role checks;
- domain-scoped link lookup;
- domain-scoped code uniqueness.

### Integration

- create domain;
- add/remove membership;
- role changes;
- create link in current domain;
- duplicate code within a domain rejected;
- same code across domains accepted;
- cross-domain API access rejected;
- domain settings isolation;
- inactive domain rejected.

### E2E

Test at least two hostnames against the same deployment:

```text
short.abc.com/test
short.dec.com/test
```

Verify that both can exist simultaneously and resolve to their respective destinations.

Also test the domain selector and role-specific administration UI.

## Implementation order

1. Prisma schema and migration.
2. Domain normalization/context service.
3. Domain membership and authorization.
4. Domain-scoped link service and public lookup.
5. Domain-scoped settings.
6. Domain-scoped collections.
7. Admin/domain management APIs.
8. Domain-aware dashboard and selector.
9. Traefik/DNS deployment documentation.
10. Isolation and multi-domain E2E tests.
11. Migration verification against an existing database.

## Non-goals for the first implementation

- separate deployments per domain;
- cross-domain collections;
- arbitrary dynamic Traefik configuration from the web UI;
- cross-domain user roles;
- trusting a client-supplied domain identifier for authorization.
