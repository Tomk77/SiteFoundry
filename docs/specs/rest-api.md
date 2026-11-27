# REST content API

- Status: Implemented (initial published delivery scope)
- Owner: Unassigned
- Created: 2026-07-22
- Last updated: 2026-07-25
- Related specifications: GraphQL content API, revisions, authentication, permissions

## Summary

The REST API provides read-only access to a site's complete persisted public delivery dataset. Every
request requires a site-owned publishable token and reads published snapshots only.

## Contract

- Base path: `/api/v1/sites/{siteKey}`.
- Authentication: `Authorization: Bearer scaffold_pub_...`.
- Responses use JSON; errors use `application/problem+json`.
- Successful responses include `ETag` and shared-cache directives and accept `If-None-Match`.
- Collections use `first` (1–100) and opaque `after` cursors.
- Optional `locale` filters collection resources.
- Browser requests are checked against the token's allowed origins. Origin-less server/build requests
  remain valid.

## Resources

| Method and path | Behavior |
| --- | --- |
| `GET /site` | Public site metadata, verified domains, and languages |
| `GET /languages` | Site languages and URL prefixes |
| `GET /pages` | Cursor-paginated universal Page collection |
| `GET /pages/{id}` | Published page by stable ID |
| `GET /pages/resolve?url=...` | Published page by relative path or verified absolute URL |
| `GET /content-types` | Published structured-content schemas |
| `GET /content-types/{slug}` | Published schema definitions by slug and locale |
| `GET /content-types/{slug}/records` | Published structured records |
| `GET /navigation` | Published header/footer navigation, filterable by locale and location. Page items carry `pageId`; their `target` is the page's current delivered path (stored path for legacy or unpublished pages) |
| `GET /redirects` | Redirects, optionally filtered by locale |
| `GET /media` | Public media metadata; empty until media persistence exists |

The base path without a resource returns the same value as `/site`.

## Page model

Every page uses one model regardless of template. It includes stable identity, locale, current
published path, template-origin metadata, SEO, ordered typed blocks, published revision identity and
version, and timestamps. Blocks include a stable ID, type, type version, and type-specific data.

## Security

- The API never returns profiles, memberships, invitations, credentials, token hashes, preview
  configuration, unverified domains, or internal settings.
- Invalid site/token pairs return the same unauthorized response to limit site enumeration.
- Revoked and expired tokens fail immediately.
- Query-string tokens are not supported.
- Draft editor rows are never queried by the delivery layer.

## Deferred work

- Confidential preview tokens and draft reads.
- Fine-grained scopes beyond `published:read`.
- Persisted media delivery.
- Webhook/CDN invalidation and resource-specific database repositories for large sites.
