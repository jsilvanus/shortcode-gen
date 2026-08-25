# Worker pipeline plan

The worker wakes approximately every three hours. Each cycle has four independent phases:

1. Cleanup
2. Statistics
3. HTTP change detection
4. Playwright rendering

## Cleanup

Delete expired login-attempt records, raw visit events older than 90 days, and other transient data. Cleanup does not depend on Playwright.

## Statistics

Process accumulated events into daily aggregates and monthly/yearly HLLs, including collection-level aggregation. Statistics does not depend on Playwright.

## HTTP change detection

Every non-expired active link is checked every cycle. Expired links are skipped.

Persist per-link HTTP state:

- `etag`
- `lastModified`
- `contentHash`
- `lastCheckedAt`
- `lastChangedAt`
- `needsRender`

Send `If-None-Match` and `If-Modified-Since` when stored values exist. A `304` means unchanged. A `200` response is hashed; an unchanged hash means no rendering is needed. Sites without cache headers use normal GET plus body hashing.

The HTTP state is persisted before rendering. The existing SSRF, timeout, and response-size protections apply.

## Playwright rendering

Playwright is launched only when the HTTP phase has render work. It is not kept alive between cycles.

Launch Chromium once per cycle and reuse it across changed pages. Each page gets a fresh browser context. The render operation produces Open Graph metadata, title/description/canonical/favicon, and a screenshot. Screenshots use persistent storage.

A rendering failure must not prevent the other worker phases from completing. Failed render work remains retryable.

## Pipeline state

PostgreSQL is the source of truth. HTTP and render state are separate so a worker restart cannot lose pending rendering work.

HTTP state:

```text
lastCheckedAt
lastChangedAt
etag
lastModified
contentHash
```

Render state:

```text
needsRender
render status
lastRenderedAt
render error
```

A pending render survives worker restart and is processed by the next cycle.
