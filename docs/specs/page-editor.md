# Page editor and content composition

- Status: Implemented (initial block-composition scope)
- Owner: Unassigned
- Created: 2026-07-28
- Last updated: 2026-07-28
- Related specifications: Page tree, page templates, revisions, GraphQL API, REST API

## Summary

Pages contain an ordered list of content blocks. Editors can add, edit, reorder, and remove blocks in
the page editor. Every explicit save stores the complete list in a new immutable concept revision;
publishing creates a separate published snapshot used by delivery APIs.

The initial block catalog is code-defined. Templates copy block values into new pages but do not retain
control over those pages.

## Block catalog

The supported blocks are:

- `hero`: eyebrow, headline, supporting copy, two actions, highlights, and an optional image.
- `richtext`: paragraph-oriented body copy.
- `quote`: quotation and optional attribution.
- `image`: image metadata and caption.
- `cta`: heading, supporting copy, and two actions.
- `metrics`: compact value/label proof points.
- `steps`: section copy and an ordered set of icon, title, and body items.
- `feature`: feature copy, benefits, and one of image, redirect, record, or code visuals.
- `pageList`: section copy and a bounded list of live published pages.
- `faq`: section copy and question/answer items.

Blocks have stable string identifiers, a type, a version, and scalar string data in persisted JSON.
Delivery GraphQL converts repeated scalar values into strongly typed item objects.

## Repeated-field authoring

The initial editor uses line-oriented fields until a reusable nested-item editor is implemented:

- highlights and benefit points: one item per line;
- metrics: `value | label`;
- steps: `icon | title | body`;
- redirect examples: `source | destination | status`;
- record fields: `label | value`;
- FAQ entries: `question | answer`.

The last column may contain additional `|` characters. Empty lines are ignored. `pageList` text may use
`{siteName}`, and metric values may use `{pageCount}`; consuming websites replace these delivery-time
tokens with public site data.

## Delivery

REST preserves the ordered block JSON. GraphQL exposes an ordered `PageBlock` union with one strongly
typed variant per catalog entry. Templates never create GraphQL types.

Published delivery remains token-gated and read-only. Concept content is not exposed by publishable
tokens.

## Validation

- Page SEO descriptions participate in readiness validation.
- Standalone image blocks require alt text.
- Hero and feature blocks require alt text when an image path is present.
- The page editor keeps authored order unchanged in concept and published snapshots.

## Deferred work

- Rich text editing and portable rich-text delivery.
- Dedicated nested-item controls instead of line-oriented entry.
- Media-library references instead of string image paths.
- User-defined block types or custom website components.
- Draft preview delivery and confidential preview tokens.
- Arbitrary revision browsing and restoration.
