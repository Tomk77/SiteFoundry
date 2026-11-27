# ADR 0007: Delivery responses are private and revalidated

- Status: Accepted
- Date: 2026-11-27

## Context

Delivery responses were sent with `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
and without `Vary: Authorization`. A shared cache (CDN, proxy) could serve one token's response to a
request with another token, or to a request with no token, and could ignore a token's revocation for
up to six minutes. Responses without an `Origin` header had no `Vary: Origin` (review finding 3.1).
The architecture overview listed caching as undecided.

Whether published content is public, so that tokens could be dropped, is a product decision that has
not been made.

## Decision

While delivery requires a token:

- Every delivery response, including errors, sends `Vary: Authorization, Origin`.
- Successful responses send `Cache-Control: private, no-cache` plus a strong `ETag` over the body.
  Browsers and server-side fetch caches may store a copy but must revalidate; a matching
  `If-None-Match` gets `304`. Shared caches do not store responses.
- Problem responses send `no-store`.
- Consuming websites cache on their side (for example ISR or their own fetch cache), keyed by URL.
- The origin allowlist is advisory. Publishable tokens are browser-visible by design, and a
  non-browser client can send any `Origin`. The database hashes the raw token itself, so a leaked
  hash cannot be used (finding 3.5).

## Consequences

- Every request still reaches the app server and the database; the ETag saves bandwidth, not work.
  Finding 3.6 (per-request bundle cost) is therefore the next performance lever.
- Revocation is effective immediately.

## Revisit when

- Product decides published content is public. Then tokens can become optional for reads and
  responses can be `public, s-maxage` with purge on publish.
- A CDN is put in front of delivery.
