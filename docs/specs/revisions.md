# Persistence and revisions

- Status: Working specification
- Owner: Unassigned
- Created: 2026-07-22
- Last updated: 2026-07-22
- Related specifications: REST content API, GraphQL content API, page tree, schema system

## Implemented delivery foundation

- Published pages have immutable `page_published_revisions` rows containing complete delivery
  snapshots.
- `pages.published_revision_id` selects the snapshot visible to consuming websites.
- Publishing creates the next page revision and atomically advances that pointer.
- Editing a previously published mutable page row does not change its delivery snapshot until publish.
- Published structured records use equivalent immutable snapshots selected by
  `content_records.published_revision_id`.
- Existing published pages and structured records are backfilled as version 1.
- Published schema definitions have an independent explicit schema version.

## Still unresolved

The full editor revision specification still needs autosave working-copy semantics, permanent explicit
save history, restore behavior, concurrent editing, revision retention, audit presentation, scheduled
publishing, and transactional publication across related resources. The implemented tables establish
the delivery invariant but do not claim to complete those workflows.

## Required invariant

Public REST and GraphQL responses must be reproducible from immutable published snapshots and must
never read an unpublished working copy.
