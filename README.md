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
