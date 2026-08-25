# Shortcode Gen

Self-hosted short-link service with optional human-readable codes, link expiration, metadata previews, and asynchronous metadata fetching.

## Development

Local development uses Node.js and SQLite; Docker is not required.

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

The application is available at `http://localhost:3000`.

The worker is started separately when implementing background metadata processing:

```bash
npm run worker
```

## Multi-domain administration

Each managed hostname is a domain. A domain may also have aliases; aliases resolve to the same domain, links, collections, users, and settings.

Domain administration is performed in the web UI by a domain `ADMIN`. Installation-level domain creation and assigning the first domain administrator are intentionally CLI operations.

Create a domain:

```bash
npm run domain -- create \
  --hostname short.example.fi \
  --name "Example organization"
```

Assign an existing user as a domain administrator:

```bash
npm run domain -- admin add \
  --domain short.example.fi \
  --username admin
```

List domain administrators:

```bash
npm run domain -- admin list --domain short.example.fi
```

Remove a domain administrator:

```bash
npm run domain -- admin remove \
  --domain short.example.fi \
  --username admin
```

The global `User.role` is not a domain-access bypass. Web access is determined by `DomainMembership`; `DomainMembership.role = ADMIN` is the authoritative domain administrator role.

## Code formats

Generated codes use a human-friendly alphabet and are case-insensitive:

```text
0123456789ACDEFHJKMNPQRTUVWXY
```

Human-written codes may use letters, numbers, `-`, and `_`, and are also case-insensitive.

Short links are root-level paths, for example:

```text
https://short.example/A7E4M
https://short.example/ilmo
```

Application routes such as `/admin`, `/api`, and `/health` are reserved.

## Deployment

See:

- `docs/technical-plan.md` — implementation architecture and phases
- `docs/plan2.md` — deployment architecture

Local development uses SQLite. Staging uses Docker Compose, PostgreSQL, and Nginx. Production uses Docker and Traefik with PostgreSQL supplied by the separate PostgreSQL project.
