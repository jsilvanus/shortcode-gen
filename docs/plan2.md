# Shortcode Gen — implementation plan 2

This plan supersedes the relevant parts of `docs/plan.md` where explicitly stated below.

## 1. Short-code alphabet

Short codes use a human-friendly, case-insensitive alphabet. Codes are stored/generated in uppercase, but public lookup MUST be case-insensitive.

The alphabet is:

```text
0123456789ACDEFHJKMNPQRTUVWXY
```

Characters that are easily confused with other characters are excluded, including `O`, `I`, `L`, `Z`, `S`, `G`, and `B`.

The goal is that a code can be read aloud, copied manually, or entered from a printed source with minimal ambiguity.

Examples:

```text
/s/A7E4M
/s/a7e4m
/s/A7e4m
```

All three forms identify the same short link.

Codes are randomly generated at 6–8 characters. The database retains a unique constraint on the canonical uppercase code. On collision, a new code is generated.

## 2. Deployment environments

The application has three clearly separated environments.

### 2.1 Local development

Local development should require as little infrastructure as possible.

```text
Developer machine
      |
      v
Next.js / Node.js
      |
      v
SQLite
```

Requirements:

- no Docker
- SQLite database
- Prisma SQLite provider
- application and worker can run directly with Node.js
- local screenshot storage on the filesystem
- `.env.local` for local configuration

Local development should not require PostgreSQL, Nginx, Traefik, or any other infrastructure service.

The application code should remain database-portable so that the development database can differ from staging and production without changing application behaviour.

### 2.2 Staging

Staging should reproduce the containerized deployment model while remaining self-contained.

```text
                    Internet / LAN
                         |
                         v
                       Nginx
                         |
                         v
                  shortcode-web
                         |
                  +------+------+
                  |             |
                  v             v
             PostgreSQL   shortcode-worker
```

Requirements:

- Docker
- Docker Compose
- PostgreSQL provided by the staging Compose stack
- Nginx as reverse proxy
- web and worker use the same application image with different commands
- persistent PostgreSQL volume
- persistent screenshot volume
- staging-specific `.env`
- HTTPS can be terminated at Nginx

Staging is the environment for testing the real PostgreSQL schema, Docker image, worker, reverse proxy, migrations, persistent storage, and production-like runtime behaviour.

### 2.3 Production

Production runs the application in Docker, but PostgreSQL is owned by a separate PostgreSQL project.

```text
                         Internet
                            |
                            v
                         Traefik
                            |
                     shortcode-web
                            |
                    +-------+-------+
                    |               |
                    v               v
             external PostgreSQL  shortcode-worker
             (other project)
```

Requirements:

- Docker
- application containers managed independently from the database project
- PostgreSQL is supplied by the existing PostgreSQL Docker project
- application connects using `DATABASE_URL`
- Traefik is the production reverse proxy / TLS terminator
- persistent screenshot storage
- production secrets supplied through `.env` or the deployment secret mechanism
- database backups remain the responsibility of the PostgreSQL project

The Shortcode Gen production deployment MUST NOT create or manage its own PostgreSQL container.

## 3. Docker images

The web application and worker should use the same Docker image whenever practical.

Example:

```text
shortcode-gen image
       |
       +--> web command
       |
       +--> worker command
```

This avoids maintaining separate application images while allowing the two processes to scale and restart independently.

The production image should contain everything required by Playwright, including its browser dependencies.

## 4. Database configuration

The application must support the following Prisma/database environments:

```text
local     -> SQLite
staging   -> PostgreSQL
production -> PostgreSQL
```

Database-specific configuration belongs in environment variables. No credentials are committed to the repository.

Schema changes use Prisma migrations.

Local:

```bash
npx prisma migrate dev
```

Staging:

```bash
npx prisma migrate deploy --schema=prisma/postgresql/schema.prisma
```

Production:

```bash
npx prisma migrate deploy --schema=prisma/postgresql/schema.prisma
```

Production must never use `prisma db push` for schema deployment.

## 5. Deployment flow

### Staging

```text
build image
    |
    v
start/update Compose stack
    |
    v
wait for PostgreSQL
    |
    v
run prisma migrate deploy
    |
    v
start web + worker
    |
    v
health check
    |
    v
smoke tests
```

### Production

```text
build/publish image
    |
    v
pull image on production host
    |
    v
update application containers
    |
    v
run prisma migrate deploy
    |
    v
start/restart web + worker
    |
    v
health check
    |
    v
verify through Traefik
```

Database migrations must be completed successfully before the application is considered deployed.

## 6. Persistent storage

The application has two important persistent data categories:

### Database

- staging: PostgreSQL Docker volume
- production: external PostgreSQL project

### Screenshots

Screenshots must survive application container replacement.

```text
/data/screenshots
```

This path is backed by a persistent volume or host directory in staging and production.

## 7. Reverse proxy responsibilities

### Staging — Nginx

Nginx handles:

- incoming HTTP/HTTPS traffic
- TLS termination where configured
- forwarding requests to the web container
- forwarding the original host/protocol information
- basic request size/time limits

### Production — Traefik

Traefik handles:

- routing the public hostname to the web container
- TLS certificate management
- HTTPS termination
- forwarding host/protocol information

The application itself should not contain environment-specific reverse-proxy logic.

## 8. Health and readiness

The application exposes a lightweight health endpoint, for example:

```text
GET /api/health
```

It should distinguish at least between:

- application process is alive
- database is reachable

Container health checks should use the health endpoint where appropriate.

The worker should also emit a clear startup log and periodically report that it is alive.

## 9. Environment files

Provide separate examples/documentation for:

```text
.env.example
.env.staging.example
.env.production.example
```

Actual `.env` files are never committed.

At minimum:

```env
DATABASE_URL=
SESSION_SECRET=
PUBLIC_URL=
SCREENSHOT_DIR=
WORKER_INTERVAL_SECONDS=60
METADATA_REFRESH_HOURS=24
FETCH_TIMEOUT_MS=15000
FETCH_MAX_BYTES=5242880
```

The production `DATABASE_URL` points to the PostgreSQL service supplied by the separate PostgreSQL project.

## 10. Deployment security

Production deployment must ensure:

- secrets are not baked into Docker images
- secrets are not committed to Git
- database ports are not unnecessarily exposed publicly
- PostgreSQL is reachable only from trusted application infrastructure
- screenshots are stored outside ephemeral containers
- containers run with the minimum practical privileges
- the reverse proxy is the public entry point
- application logs do not contain passwords, session tokens, or database credentials

## 11. Rollback

Application image versions should be identifiable by immutable image tag or commit SHA.

A failed deployment should be recoverable by:

1. stopping/replacing the failed application image with the previous known-good image;
2. verifying application health;
3. verifying database compatibility;
4. restoring the previous application version if necessary.

Database migrations must be designed with backwards compatibility in mind when a rolling/rollback deployment is possible. Destructive schema changes should not be coupled blindly to an application release.

## 12. Testing the deployment

Staging should verify at least:

- application starts from a clean Docker deployment
- PostgreSQL migration succeeds
- admin login works
- short-link creation works
- worker processes metadata jobs
- screenshots persist across container recreation
- public short links work through Nginx
- countdown/interstitial works
- application survives a web-container restart
- application survives a worker restart

Production deployment verification should be intentionally small and safe:

- health endpoint
- admin login
- create/test short link where appropriate
- worker health/log verification
- public URL through Traefik

## 13. Separation of responsibilities

Shortcode Gen owns:

- application containers
- application configuration
- Prisma migrations
- screenshot storage
- web and worker processes
- application deployment

The separate PostgreSQL project owns:

- PostgreSQL container/service
- PostgreSQL configuration
- database storage
- database backups
- database recovery

This separation keeps the production Shortcode Gen deployment small and allows the existing PostgreSQL infrastructure to be reused.
