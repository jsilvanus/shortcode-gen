# Shortcode Gen

Self-hosted, multi-domain short-link service with human-readable codes, link expiration, metadata previews, asynchronous metadata/rendering jobs, QR codes, collections, analytics, API access, audit logging, and MCP access.

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

Run the background worker separately when needed:

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

## Documentation

Current documentation:

- `docs/architecture.md` — current system architecture
- `docs/features.md` — implemented/partial/planned feature inventory
- `docs/roadmap.md` — current gaps and future work
- `docs/data-inventory.md` — privacy-oriented data inventory
- `docs/privacy.md` — privacy/data-protection engineering assessment
- `docs/security.md` — security architecture and assessment
- `docs/privacy-security-assessment.md` — GDPR/ISO-oriented self-assessment
- `docs/operations.md` — deployment and operations
- `docs/api.md` — API overview
- `docs/mcp.md` — MCP overview
- `docs/documentation-status.md` — documentation maintenance rules

Historical plans are retained separately. `docs/first-plan.md` marks the original plan as historical; `docs/technical-plan.md` and `docs/plan2.md` are also retained for architectural history.

## Deployment

Local development uses SQLite. Staging uses Docker Compose and PostgreSQL. Production uses Docker and Traefik with PostgreSQL supplied by the separate PostgreSQL project.

The PostgreSQL schema and its migration history live under `prisma/postgresql/`. Apply them with:

```bash
npm run db:deploy:postgresql
```

See `docs/operations.md` for the current operational model.

## Assurance status

The project contains meaningful security and privacy engineering controls, but it does **not** claim GDPR compliance certification, ISO/IEC 27001 certification, ISO/IEC 27701 certification, or an independent penetration/privacy audit. See `docs/privacy-security-assessment.md`.
