# Persistence and revisions

- Status: Working specification
- Owner: Unassigned
- Created: 2026-07-22
- Last updated: 2026-11-27
- Related specifications: REST content API, GraphQL content API, page tree, schema system

## Implemented page concept and publication model

- Every explicit **Save concept** creates an immutable `page_revisions` row. Revisions are numbered
  per page and store a complete page snapshot.
- `pages.concept_revision_id` selects the latest explicitly saved concept. The mutable `pages` row is
  the editor/query projection of that concept.
- Saving accepts the concept revision the editor loaded. A mismatched pointer rejects the save so
  concurrent editors cannot silently overwrite a newer explicit revision.
- Published pages have separate immutable `page_published_revisions` rows containing complete
  delivery snapshots.
- `pages.published_revision_id` selects the snapshot visible to consuming websites.
- Each published revision records the concept revision it came from.
- Publishing explicitly saves a new concept revision, creates the next published snapshot from that
  exact state, and atomically advances both pointers.
- Editing a previously published mutable page row does not change its delivery snapshot until publish.
- Editors can switch between the editable concept and the read-only live version. The editor counts
  changed fields and blocks, disables redundant publication, and can discard a concept by restoring
  the published snapshot.
- Renaming a page from the page tree (`rename_page`) creates a concept revision like any other save.
  Pages are deleted only through `delete_page`, which refuses the homepage and pages with children.
  Menus are published through `publish_navigation_menu` with the database clock.
- **Unpublish** (`unpublish_page`, page tree row menu, publish capability) sets the page back to
  concept and clears `published_revision_id`. The concept and all revisions stay. The homepage
  cannot be unpublished.
- Existing pages are backfilled with concept revision 1. Existing published snapshots are linked to
  that concept only when their stored content matches, preserving ambiguity rather than claiming a
  false origin.

## Implemented delivery foundation

- Published structured records use equivalent immutable snapshots selected by
  `content_records.published_revision_id`.
- Existing published structured records are backfilled as version 1.
- Published schema definitions have an independent explicit schema version.
- Setting a record back to concept clears its `published_revision_id`, which unpublishes it.
  Records have no separate concept stage: saving a published record republishes it.
- Delivered page paths are computed at read time from the live tree and each page's published slug
  (ADR 0006). Moves are live immediately; slug changes go live on publish. Both record redirects for
  every affected published page, upserted and with chains collapsed.
- Delivery only serves pages and records whose status is `published` and that have a published
  revision (defence in depth against a stale pointer).

## Explicitly deferred

- Autosave must use a separate temporary working-copy store and must not create permanent revisions.
- Revision-history browsing, naming, comparison, and restoration of arbitrary older revisions.
- Retention and archival policy.
- Rich audit presentation beyond creator and timestamp metadata.
- Scheduled publication and transactional publication across related resources.
- A confidential preview token and API mode for reading the saved concept. Public delivery remains
  published-only.

## Required invariant

Public REST and GraphQL responses must be reproducible from immutable published snapshots and must
never read an unpublished working copy.
