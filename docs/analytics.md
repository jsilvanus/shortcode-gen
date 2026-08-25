# Analytics and retention

Shortcode Gen keeps two levels of link statistics.

## Short-lived visit events

Individual visit events are retained for **90 days**.

Each event records:

- short link
- event type: `PAGE_VIEW` or `REDIRECT`
- privacy-preserving visitor hash
- timestamp

The raw IP address and User-Agent are never persisted.

The visitor identifier is an HMAC-SHA256 over the normalized IP address and User-Agent, keyed by a server-side `ANALYTICS_SECRET`.

The secret must never be stored in the database or exposed to clients.

## Permanent daily aggregates

Daily aggregates are retained indefinitely.

For each short link and calendar day, store:

- page views
- redirects
- unique page viewers
- unique redirect visitors

The daily aggregate is therefore useful for long-term statistics without retaining individual visit records indefinitely.

## Page view vs redirect

These are deliberately separate events.

`PAGE_VIEW` means the short-link page was requested.

`REDIRECT` means the application actually initiated the navigation to the destination.

A crawler/social preview fetch may produce a page view without producing a redirect.

## Retention worker

The scheduled worker removes `LinkVisit` records older than 90 days. It does not remove `LinkDailyStat` records.

Daily aggregation should happen when an event is recorded, so the permanent statistic does not depend on retaining the raw event for 90 days.
