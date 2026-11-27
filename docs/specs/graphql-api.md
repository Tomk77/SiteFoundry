# GraphQL content API

- Status: Implemented (initial published delivery scope)
- Owner: Unassigned
- Created: 2026-07-22
- Last updated: 2026-07-28
- Related specifications: REST content API, schema system, revisions, authentication

## Summary

GraphQL exposes the same token-gated published delivery data as REST at
`/api/v1/sites/{siteKey}/graphql`. It accepts GET and JSON POST requests and has no mutations.

## Type model

- One `Page` type represents every page. Page templates never generate GraphQL types.
- `Page.blocks` is an ordered `PageBlock` union containing `HeroBlock`, `RichTextBlock`, `QuoteBlock`,
  `ImageBlock`, `CtaBlock`, `MetricsBlock`, `StepsBlock`, `FeatureBlock`, `PageListBlock`, and
  `FaqBlock`.
- Each block contains stable identity and a version in addition to its strongly typed fields.
- Line-oriented repeated editor values are exposed as typed GraphQL lists such as
  `MetricsBlock.metrics`, `StepsBlock.steps`, and `FaqBlock.questions`, backed by `MetricItem`,
  `StepItem`, and `FaqItem` object types. Consumers do not parse the persisted delimiter format.
- Each published structured-content type generates a strongly typed field under `content`, such as
  `content.colleagues` or `content.jobOpenings`.
- Site, languages, navigation, redirects, revision metadata, and the currently empty media collection
  are available as root queries.

## Root queries

- `site`
- `languages`
- `page(id: ID, url: String)`
- `pages(locale: String, first: Int, after: String)`
- `content { <publishedContentType>(locale, first, after) }`
- `navigation(locale: String, location: String)`
- `redirects(locale: String)`
- `media`

Schema introspection is enabled. Queries are limited to depth 12, 250 selected fields, a 100 KB
request body, and collection page sizes of at most 100.

## Administration playground

Site Settings includes a GraphQL playground under **API access**. It targets the active site's
versioned GraphQL endpoint and embeds Apollo Sandbox. The embedded IDE provides schema introspection,
the schema reference, autocomplete, query building, variables, headers, and response inspection. A
newly created publishable token is filled in and connected automatically; otherwise the user pastes a
token and explicitly connects it.

Scaffold CMS's request handler sends the token only in the `Authorization` header. It does not add tokens
to URLs or persist them across reloads. A token with allowed browser origins must include the
administration application's origin before the embedded playground can use it.

The playground also links to the hosted Apollo Sandbox with the endpoint and sample query populated.
The external link never includes the token. To use the hosted Sandbox, the user must add the header
there and allow `https://studio.apollographql.com` on an origin-restricted token.

## Schema publication

Editable content-field definitions do not immediately alter GraphQL. The initial migration snapshots
existing definitions as schema version 1. `publish_content_type_schema` creates a new published schema
version after authorization, and only when the fields changed. Since 2026-11-27 the admin calls it on
every content type save, seeded types of a new language are published immediately, and a migration
published every type whose schema had drifted (finding 2.4). A breaking-change preview remains part
of the broader schema-system work.

## Robustness (2026-11-27)

- Structured-content fields are nullable and coerced to their declared type; a missing or malformed
  value yields `null` for that field only. Missing required block strings resolve to `""`.
- Generated record and connection types get a `Content` prefix when they would clash with a built-in
  type (for example a content type called `page`). A content field whose key is a system field
  (`id`, `locale`, `revisionId`, `revisionVersion`, `publishedAt`) is exposed as `<key>Field`.
- Depth (12) and field (250) limits are counted with fragment spreads expanded.
- Introspection stays enabled: the schema is not confidential (tokens are publishable) and the
  Site Settings GraphQL playground depends on it.

## Errors and caching

Authentication and HTTP-level failures use the REST problem format. GraphQL parsing, validation, and
execution failures use standard GraphQL `errors`. Responses are `private, no-cache` with an `ETag` and `Vary: Authorization, Origin` (ADR 0007).
Invalid `variables` JSON and non-JSON bodies are `400`; bodies over 100 kB are `413`.

## Deferred work

- Persisted/query allowlists.
- Cost weighting beyond depth and selected-field limits.
- Subscriptions.
- Draft preview and confidential preview tokens.
- Automatic frontend code generation.
