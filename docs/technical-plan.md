# Shortcode Gen — Technical Implementation Plan

## 1. Goal

Shortcode Gen is a small self-hosted short-link service. An administrator creates short links for long URLs. Visiting a short link shows a server-rendered interstitial page with metadata, a screenshot/preview, and a short countdown before navigation to the destination.

The service is designed to remain simple and lightweight while supporting temporary links, human-readable custom codes, asynchronous metadata fetching, and safe production deployment.

## 2. Technology

- TypeScript
- Next.js / App Router
- React
- Prisma
- SQLite for local development
- PostgreSQL for staging and production
- Argon2id for password hashing
- Server-side sessions with HttpOnly cookies
- Node `fetch` for normal metadata fetching
- HTML metadata parser
- Playwright for screenshots and JavaScript-rendered fallback
- Docker for staging and production
- Docker Compose for staging
- Nginx for staging reverse proxy
- Traefik for production reverse proxy

Redis is not required. Background work is represented by database jobs.

## 3. Environments

### Local development

No Docker is required.

```text
Next.js / Node.js
       |
       v
     SQLite
```

The developer can run the application and worker directly with Node.js. SQLite keeps local setup simple.

### Staging

```text
                 Nginx
                   |
          +--------+--------+
          |                 |
          v                 v
    shortcode-web     shortcode-worker
          |                 |
          +--------+--------+
                   |
                   v
              PostgreSQL
```

Staging uses Docker Compose and provides its own PostgreSQL container.

### Production

```text
                  Traefik
                     |
             shortcode-web
                     |
              +------+------+
              |             |
              v             v
 external PostgreSQL   shortcode-worker
  (other project)
```

Production uses Docker. PostgreSQL is supplied by the separate PostgreSQL project and is not created by Shortcode Gen.

## 4. Repository structure

```text
shortcode-gen/
├── app/
│   ├── admin/
│   │   ├── login/
│   │   └── dashboard/
│   ├── [code]/
│   ├── api/
│   │   ├── auth/
│   │   ├── links/
│   │   └── health/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── admin/
│   ├── redirect/
│   └── ui/
├── lib/
│   ├── auth/
│   ├── db/
│   ├── links/
│   ├── metadata/
│   ├── security/
│   └── validation/
├── worker/
│   ├── index.ts
│   ├── metadata-job.ts
│   └── scheduler.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── scripts/
│   └── create-user.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 5. Public URL structure

Short links are root-level paths. There is no `/s/` prefix.

Examples:

```text
https://short.example/A7E4M
https://short.example/ilmo
https://short.example/AI-2026
```

The application has explicit reserved routes such as:

```text
/admin
/api
/health
```

Additional technical routes such as `/favicon.ico` or `/robots.txt` are reserved if the application serves them.

Custom codes must not conflict with reserved routes, using case-insensitive comparison.

## 6. Short-code types

There are two code categories.

### Generated codes

Generated codes use a human-friendly, case-insensitive alphabet:

```text
0123456789ACDEFHJKMNPQRTUVWXY
```

Ambiguous characters are deliberately excluded, including `O`, `I`, `L`, `Z`, `S`, `G`, and `B`.

Generated codes are 6–8 characters long. They are stored canonically in uppercase. Public lookup is case-insensitive.

For example:

```text
/A7E4M
/a7e4m
/A7e4m
```

all refer to the same generated code.

### Human-written/custom codes

Custom codes are intended for memorable links such as:

```text
/ilmo
/kirkko
/AI-2026
/kirkko_suomi
```

Custom codes may use:

```text
A-Z
 a-z
0-9
-
_
```

They are also case-insensitive. `ilmo`, `Ilmo`, and `ILMO` identify the same code.

Custom codes must have a reasonable length limit and must not equal a reserved route. The exact maximum length should be established during implementation; 64 characters is a reasonable starting point.

The database stores a canonical representation and enforces uniqueness on that representation.

## 7. Database model

### users

```text
id
username
password_hash
created_at
updated_at
```

Only one administrator user type is required for the MVP.

### short_links

```text
id
code
code_type
target_url

title
description
canonical_url
image_url
favicon_url

screenshot_path
screenshot_width
screenshot_height

metadata_source
content_hash

created_at
updated_at
last_checked_at
last_successful_fetch_at

expires_at

click_count
last_clicked_at
active
```

`code` is unique in its canonical, case-insensitive representation.

`expires_at` is nullable. `NULL` means that the link does not expire.

### jobs

```text
id
type
short_link_id
status
attempts
run_after
started_at
finished_at
last_error
created_at
updated_at
```

Initial job types:

- `FETCH_METADATA`
- `REFRESH_METADATA`

Statuses:

- `pending`
- `running`
- `completed`
- `failed`

## 8. Link TTL / expiration

Links may have an optional TTL.

The API/admin UI should allow the administrator to specify an expiration time when creating or editing a link.

A link is valid only when:

```text
active = true
AND
(expires_at IS NULL OR expires_at > current_time)
```

Expiration is checked during the public request itself. The worker must not be required to run at the exact expiration time.

The scheduled worker can additionally deactivate or clean up expired links during maintenance runs.

An expired link should return a dedicated expired/not-found response and must never navigate to its target.

## 9. Authentication

### Login

- username
- password
- login/logout
- server-side session
- HttpOnly cookie
- Secure cookie in HTTPS environments
- SameSite=Lax
- no localStorage token
- no JWT for the MVP

Passwords are stored using Argon2id hashes.

Admin creation is performed with:

```bash
npm run create-user
```

### Dashboard

The dashboard shows at least:

- screenshot/thumbnail
- destination title
- short code
- expiration status/time
- metadata status/time

The administrator can create, edit, deactivate, delete, copy, and open links.

## 10. Link creation

The administrator supplies:

- target URL
- optional custom code
- optional expiration/TTL

The server validates the URL, validates/resolves the requested code, stores the link, and creates a metadata job.

```text
validate input
     |
     v
create short_link
     |
     v
create FETCH_METADATA job
     |
     v
wake worker
     |
     v
return to admin
```

If no custom code is supplied, a random generated code is created.

## 11. Worker architecture

The worker is intentionally **not a continuously polling process**.

Normal maintenance runs approximately eight times per day, every three hours:

```text
00:00
03:00
06:00
09:00
12:00
15:00
18:00
21:00
```

Scheduled runs process:

- pending metadata jobs
- failed jobs eligible for retry
- metadata refreshes due for active links
- expired-link maintenance
- other periodic maintenance

### Immediate wake-up

Creating or updating a link should wake the worker immediately so that metadata does not have to wait up to three hours.

The wake-up mechanism must not be the source of truth. The database job remains authoritative.

If the wake-up signal is lost, the next scheduled run will find and process the pending job.

The initial implementation should avoid introducing Redis merely for wake-up signalling. A simple internal application/container mechanism is preferred.

The worker may process all currently pending jobs and then sleep/exit until the next scheduled invocation.

## 12. Metadata fetching

Metadata is fetched asynchronously by the worker.

First attempt:

- normal HTTP request with Node `fetch`
- parse returned HTML
- extract title, description, Open Graph data, canonical URL, favicon

Fallback:

- Playwright when JavaScript rendering is required or normal fetching does not produce sufficient metadata

Playwright is not used for every URL by default.

## 13. Screenshots

Playwright may capture one desktop screenshot of the target page.

Initial target size:

```text
1280 x 720
```

Screenshots are stored persistently, for example:

```text
/data/screenshots/<code>.webp
```

Container replacement must not delete screenshots.

## 14. Public interstitial

`GET /:code` returns a server-rendered HTML page.

The page contains:

- target screenshot when available
- target title
- target description where appropriate
- destination hostname/URL
- five-second countdown
- automatic navigation
- control to stop navigation
- manual navigation button when stopped

Example:

```text
Olet siirtymässä eteenpäin

[target screenshot]

[target title]
example.com/page

5

Sivulle siirrytään automaattisesti

[Pysäytä siirtyminen]
```

The page should remain reasonably useful without JavaScript.

## 15. Social sharing

The server-rendered page includes:

```text
og:title
og:description
og:image
og:url

twitter:card
twitter:title
twitter:description
twitter:image
```

Social crawlers should receive the preview metadata without running JavaScript.

If the target page has no useful `og:image`, a future enhancement may generate a unified preview image from the screenshot, title, and destination.

## 16. Search engines

Short-link pages are not intended to be indexed:

```html
<meta name="robots" content="noindex,nofollow">
```

A canonical target URL may be included when known, but the short-link page should not become an indexed duplicate of the target page.

## 17. Metadata refresh

Active links are refreshed approximately once per day.

The refresh is scheduled through the normal three-hour worker runs. A due link is selected when its metadata is old enough to require refresh.

The worker first performs a normal HTTP fetch and calculates a content hash.

If relevant content has not changed, a new screenshot is not necessary.

If content has changed, Playwright may create a new screenshot.

Refresh work never occurs during a public short-link request.

## 18. SSRF protection

The server fetches administrator-supplied URLs, so outbound fetching is a security-critical component.

`lib/security/url-safety.ts` validates at least:

- only `http` and `https`
- no localhost
- no loopback addresses
- no RFC1918 private IPv4 addresses
- no link-local addresses
- no private/local IPv6 addresses
- DNS resolution checks
- redirects revalidated on every hop
- connection and overall timeouts
- response-size limit
- controlled redirect count

Playwright must receive equivalent network restrictions and isolation as far as practical.

## 19. HTTP limits

Initial limits:

```text
connect timeout: 5 s
overall timeout: 15 s
max response: 5 MB
max redirects: 5
```

All limits should be configurable through environment variables.

## 20. API

Initial routes:

```text
GET    /:code
GET    /admin/login
GET    /admin/dashboard
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/links
GET    /api/links
GET    /api/links/:id
PATCH  /api/links/:id
DELETE /api/links/:id
GET    /api/health
```

The exact Next.js route implementation may differ while preserving the public URL contract.

## 21. Docker and runtime

The web application and worker should normally use the same Docker image with different startup commands.

Local development does not use Docker.

Staging uses Docker Compose with:

```text
postgres
web
worker
```

Production uses Docker for web and worker, while PostgreSQL is provided by the separate PostgreSQL project.

The production application receives its database connection through `DATABASE_URL`.

## 22. Environment configuration

`.env.example` should document at least:

```env
DATABASE_URL=
SESSION_SECRET=
PUBLIC_URL=
SCREENSHOT_DIR=/data/screenshots
WORKER_INTERVAL_SECONDS=60
METADATA_REFRESH_HOURS=24
FETCH_TIMEOUT_MS=15000
FETCH_MAX_BYTES=5242880
```

The worker interval variable may be renamed/removed once scheduled invocation is finalized; the important design is that the worker does not continuously poll the database.

Actual `.env` files never belong in Git.

## 23. Prisma

Local development:

```bash
npx prisma migrate dev
```

Staging and production:

```bash
npx prisma migrate deploy
```

Production must not use `prisma db push` for schema deployment.

## 24. Testing

### Unit tests

- generated code alphabet
- generated code length
- case-insensitive code normalization
- custom code validation
- reserved route detection
- URL validation
- TTL/expiration logic
- private IP detection
- metadata parsing
- content hashing

### Integration tests

- user creation
- login/logout
- unauthorized admin access
- generated link creation
- custom link creation
- duplicate code handling
- case-insensitive lookup
- TTL expiration
- link persistence
- worker job lifecycle
- wake-up behaviour

### E2E tests

Playwright should test at least:

```text
login
-> dashboard
-> create generated link
-> create custom link
-> metadata preview
-> open short link
-> countdown
-> stop redirect
-> expired link
```

## 25. Observability

MVP uses structured logs.

Examples:

```text
INFO  link created code=A7E4M
INFO  metadata job started code=A7E4M
INFO  metadata job completed code=A7E4M
WARN  metadata job failed code=A7E4M error=timeout
```

Never log:

- passwords
- password hashes
- session tokens
- Authorization headers
- database credentials
- other secrets

A health endpoint should distinguish application availability from database connectivity where practical.

## 26. Analytics

The MVP does not collect IP addresses or user agents.

It may store only:

- `click_count`
- `last_clicked_at`

More detailed analytics can be added later if needed.

## 27. Deployment plan

### Local

```text
Node.js + Next.js
SQLite
No Docker
```

### Staging

```text
Docker Compose
PostgreSQL
Nginx
web + worker
persistent volumes
```

### Production

```text
Docker
Traefik
web + worker
PostgreSQL supplied by separate project
persistent screenshot storage
```

Staging deployment should validate the complete containerized runtime before production deployment.

Production application deployment should use identifiable image versions and support rollback to a previous known-good application image, subject to database migration compatibility.

The separate PostgreSQL project remains responsible for PostgreSQL backups and recovery.

## 28. Implementation phases

### Phase 1 — Foundation

- Next.js + TypeScript
- project structure
- Prisma
- SQLite local configuration
- PostgreSQL configuration for staging/production
- environment handling
- basic layout
- health endpoint

**Result:** application boots locally and can connect to the local database.

### Phase 2 — Authentication and admin

- users schema
- Argon2id password hashing
- create-user script
- server-side sessions
- login/logout
- admin authorization
- initial dashboard shell

**Result:** secure administrator area.

### Phase 3 — Short-link management

- generated code algorithm
- human-friendly alphabet
- case-insensitive normalization
- custom codes
- reserved routes
- URL validation
- link creation/list/edit/deactivate/delete
- TTL/expiration

**Result:** administrator can fully manage short links.

### Phase 4 — Job system and metadata worker

- jobs schema
- worker
- scheduled three-hour runs
- immediate wake-up mechanism
- retry handling
- metadata fetcher
- HTML parser
- Playwright fallback
- screenshots
- metadata refresh

**Result:** links automatically acquire and maintain previews without blocking public requests.

### Phase 5 — Public short-link experience

- root-level `/:code` route
- expiration handling
- server-rendered interstitial
- countdown
- stop/manual navigation
- Open Graph metadata
- Twitter metadata
- noindex

**Result:** the complete public short-link experience.

### Phase 6 — Security hardening

- SSRF protections
- DNS/rebinding considerations
- redirect validation
- fetch limits
- Playwright network restrictions
- secure cookies
- security headers
- request validation
- secret/log review

**Result:** production-oriented security baseline.

### Phase 7 — Testing and observability

- unit tests
- integration tests
- E2E tests
- worker tests
- health/readiness checks
- structured logs
- failure/retry testing
- expiration and code-collision testing

**Result:** reproducible confidence in application behaviour.

### Phase 8 — Deployment

- Dockerfile
- staging Docker Compose
- staging PostgreSQL
- Nginx configuration
- production container configuration
- Traefik labels/configuration
- persistent screenshot storage
- migration deployment
- deployment documentation
- rollback procedure
- staging smoke tests

**Result:** repeatable staging and production deployment.

## 29. MVP exclusions

The first release does not include:

- multiple user roles
- user registration
- Redis
- API keys
- custom domains
- QR-code generation
- bulk import
- teams
- complex analytics
- automatic link creation by external users

Custom codes and TTL are part of the MVP because they are central to the intended use of the service.
