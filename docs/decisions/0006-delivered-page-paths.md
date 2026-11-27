# ADR 0006: Compute delivered page paths at read time

- Status: Accepted
- Date: 2026-11-27

## Context

Published page snapshots stored the page path at publication time. After `move_page`, the API kept
serving the page and its descendants at their old paths while the new redirect pointed at a path that
resolved to nothing. A slug change saved through the editor changed descendants nowhere and created no
redirect (review finding 2.2). Moving a page back and forth also produced redirect loops and then a
unique-constraint error (2.3).

Two options: re-snapshot the whole subtree on every move and slug change, or compute the path when
delivering.

## Decision

Compute the delivered path at read time (`private.published_page_path`).

- The tree shape is live: moves take effect immediately, as the page tree already presents them.
- Each segment uses that page's published slug, or its live slug if it was never published. A slug
  change therefore goes live when the page is published, not when the concept is saved.
- `parentId` in delivery is the live parent.
- Every automatic redirect goes through `private.record_redirect`: it skips no-op redirects, deletes
  any redirect whose source is now a live path, points older redirects at the newest path, and
  upserts on the source path.
- `move_page`, `publish_page` and `save_page_revision` (when publishing) record redirects for every
  published page in the affected subtree whose published path changed.

## Consequences

- Published snapshots stay immutable; their stored `path` is historical and is overridden in delivery.
- Delivery does one ancestor walk per published page. That is fine for current site sizes; WP3 finding
  3.6 (whole-site bundle per request) is the place to optimise.
- Moving a published page is visible on the live site immediately, even without publishing.

## Revisit when

- Delivery stops building the whole site per request (3.6), or trees grow deep enough that per-page
  ancestor walks show up in profiles. A materialised path column maintained by the tree functions is
  the likely replacement.
