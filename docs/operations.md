# Operations Guide

**Status:** current operational guide; verify against deployment files before production changes.

## Local development

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Run the worker separately when needed:

```bash
npm run worker
```

## PostgreSQL migrations

The repository has a separate PostgreSQL Prisma schema/migration history.

```bash
npm run db:deploy:postgresql
```

Production should use migrations and must not use `prisma db push`.

## Domain bootstrap

Installation-level domain operations are available through the CLI.

Create a domain:

```bash
npm run domain -- create --hostname short.example.fi --name "Example organization"
```

Add an administrator:

```bash
npm run domain -- admin add --domain short.example.fi --username admin
```

List administrators:

```bash
npm run domain -- admin list --domain short.example.fi
```

Remove an administrator:

```bash
npm run domain -- admin remove --domain short.example.fi --username admin
```

## User bootstrap

The repository also provides a `create-user` script for creating accounts.

## Deployment model

### Staging

The repository provides `docker-compose.staging.yml` for a PostgreSQL-backed containerized environment.

### Production

The repository provides `docker-compose.production.yml`. Production PostgreSQL is supplied by the separate PostgreSQL project.

The production application should therefore receive its PostgreSQL connection through `DATABASE_URL`; the Shortcode Gen production stack should not create an independent database service.

## Persistent storage

Screenshots and rendered assets must live on persistent storage rather than only inside the writable layer of an application container.

Before replacing a production container, verify that the screenshot storage path is mounted persistently.

## Deployment sequence

Recommended sequence:

```text
build/publish image
       |
       v
update application stack
       |
       v
run PostgreSQL migrations
       |
       v
start/restart web + worker
       |
       v
health check
       |
       v
smoke test
```

The exact order may be adapted to the deployment platform, but schema compatibility must be considered before switching application versions.

## Health

Use the application's health endpoint for service checks. The deployment should verify both process availability and database connectivity where the endpoint supports it.

## Worker

The worker is responsible for asynchronous jobs such as metadata fetching/rendering. The database job record is authoritative. Operational wake-up mechanisms must not be treated as durable job storage.

## Logs

Logs should be treated as operational data and must not contain:

- passwords;
- session tokens;
- raw API keys;
- database credentials;
- Authorization headers.

## Backups

The production PostgreSQL database is owned by the separate PostgreSQL project. That project is responsible for database backups and recovery.

Shortcode Gen still needs documented restore verification because application correctness depends on successful database recovery.

## Rollback

Application images should have identifiable immutable versions, preferably commit-based tags/digests. A rollback must account for database migration compatibility.

Avoid releases where a destructive migration makes the previous application image unusable unless rollback is intentionally impossible and the deployment procedure accounts for it.

## Security maintenance

Before production releases:

1. review dependency updates;
2. run CI;
3. review migration changes;
4. review security-sensitive URL-fetching changes;
5. verify secrets are not included in the image or Git diff;
6. verify the production configuration;
7. run a health/smoke test.

## Still to document/verify

- exact production secret-delivery mechanism;
- host/container hardening baseline;
- screenshot backup policy;
- restore testing procedure;
- incident-response runbook;
- maintenance scheduling for all retention jobs.
