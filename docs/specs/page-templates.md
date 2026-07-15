# Page templates

- Status: Implemented
- Owner: Unassigned
- Created: 2026-07-15
- Last updated: 2026-07-15
- Related specifications: Page tree, page editor, schema system, revisions

## 1. Summary

Page templates are language-scoped, database-managed starting points for new pages. A template defines an ordered set of components and default content. Creating a page copies that definition into the page with fresh component identifiers. The template has no continuing control over pages created from it.

## 2. Goals

- Let authorized editors define reusable starting structures without creating rigid page types.
- Give editors a clear template choice when creating a page.
- Keep existing pages independent when templates are edited, renamed, or deleted.
- Keep an immutable database revision snapshot for every saved template version.
- Surface invalid templates before an editor creates a page from them.

## 3. Non-goals

- Automatically updating pages after their source template changes.
- Publishing template definitions through the content API.
- Enforcing parent-child template restrictions in the initial scope.

## 4. Users and permissions

- Site owners, administrators, and editors may manage templates for languages they can edit.
- Site viewers may inspect templates but cannot mutate them.
- Editors may choose only published, valid templates while creating pages.
- Row-level security and security-definer operations enforce language membership and edit access.

## 5. Terminology

- **Template key:** Stable kebab-case identifier stored in the database and page origin metadata.
- **Fallback template:** The one template used when a parent has no preferred child template.
- **Preferred child template:** The template suggested by a specific parent page.
- **Copy-on-create:** A one-time deep copy of template content into a new page.
- **Origin metadata:** The template key recorded on a page for reporting only.

## 6. User journeys

### Journey: Manage templates

1. An authorized editor opens Page templates from the main navigation.
2. The system lists the language's templates, lifecycle state, validation state, component summary, usage count, and fallback role.
3. The editor creates, edits, duplicates, renames, publishes, changes fallback, or deletes a template.
4. The system validates and saves the language-scoped definition with a revision snapshot.

### Journey: Create a page from a template

1. An editor chooses Add page or quick-add beneath a parent.
2. The system suggests the parent's preferred child template or the site fallback.
3. The editor selects a valid template, title, and URL slug.
4. The system creates a concept page containing deep-copied components with fresh IDs.
5. The editor can freely change the page without affecting the template.

## 7. Functional requirements

- **REQ-001:** Templates must be scoped to a site language and stored in the database.
- **REQ-002:** Every language template registry must contain at most one fallback template and established languages must have one published fallback.
- **REQ-003:** Template keys must be stable, unique, and kebab-case.
- **REQ-004:** The overview must support search whose state is represented in the URL.
- **REQ-005:** Authorized editors must be able to create empty templates or duplicate existing templates.
- **REQ-006:** Authorized editors must be able to edit template metadata, lifecycle status, components, defaults, ordering, and preview context.
- **REQ-007:** Components must support add, reorder, move up, move down, duplicate, and remove actions.
- **REQ-008:** Field schemas must support text, rich text, number, boolean, choice, date, URL, media, reference, and grouped/repeatable values.
- **REQ-009:** The editor must provide component and settings views, live preview, JSON view, validation, and revision information.
- **REQ-010:** Invalid templates must be unavailable in page creation and show actionable validation issues.
- **REQ-011:** New pages must receive deep-copied component data with fresh stable component IDs.
- **REQ-012:** New pages must record `created_from_template_id` and the historical `created_from_template_key` for reporting without establishing a live content dependency.
- **REQ-013:** A parent may specify a preferred child template key. The fallback is used when none is set.
- **REQ-014:** Deleting or editing a template must not delete or mutate existing pages.
- **REQ-015:** The fallback template cannot be deleted until another valid template becomes fallback.
- **REQ-016:** Page title and sibling URL collisions must block page creation with a useful error.
- **REQ-017:** Quick-add must choose a unique default title and slug when previous untitled pages exist.
- **REQ-018:** Draft templates must remain visible in template management but unavailable during page creation.
- **REQ-019:** Every create or update operation must append a revision snapshot.
- **REQ-020:** Usage counts must be computed from template origin metadata without loading the complete page tree.

## 8. States and lifecycle

Templates have `draft` and `published` lifecycle states and an independent valid or invalid validation state. Only published, valid templates may create pages or become fallback. Saves append immutable revision snapshots. Pages created from a template begin as concepts and then follow the normal page lifecycle.

## 9. Data and relationships

- `page_templates` stores language ownership, metadata, lifecycle and fallback status, preview context, defaults, and ordered components.
- `page_template_revisions` stores immutable versioned snapshots and author metadata.
- Page rows store the optional template origin ID, historical origin key, and preferred child template key.
- Component IDs are regenerated during copy-on-create to prevent identity sharing between the template and page.
- Usage counts are reporting data and do not form an ownership relationship.

## 10. Validation and errors

Saving is blocked for duplicate or invalid keys, missing required defaults, unknown component types, malformed URLs, or attempts to make a draft template the fallback. Database errors must preserve unsaved editor state and display a recoverable message. Draft and invalid templates remain visible to authorized editors but cannot be used to create pages.

## 11. API requirements

Template management is not part of the public content API. Authenticated database operations provide a compact template workspace, atomic save, fallback, and delete actions. Page REST and GraphQL APIs may later expose origin metadata to authorized administrative consumers, but rendered websites must not rely on it.

## 12. UI behaviour

The overview includes loading, error, empty, and no-results states. Search is restorable from the URL. Destructive operations use confirmation dialogs and explain that existing pages remain safe. The editor follows the page editor's two-pane composition model and synchronizes component selection with preview focus where supported.

## 13. Performance and scale

The initial implementation targets hundreds of templates and components per language. The overview loads a compact database payload containing templates, revisions, and aggregate usage counts without fetching the page tree. Page creation performs one local clone plus the normal page persistence operations.

## 14. Security and privacy

Row-level security limits reads to site members and writes to owners, administrators, and editors. Database functions re-check language edit permission and apply fallback, rename, and delete operations atomically. Revision writes are trigger-owned and cannot be forged through the client.

## 15. Local development and production

Template editing is available in local development and production to authorized users. The database is the single source of truth. Schema changes and initial template seeds are applied through versioned migrations.

## 16. Accessibility

All actions must be keyboard reachable. Dialogs trap and restore focus. Validation status must not rely on color alone. Reordering requires keyboard alternatives through move-up and move-down actions.

## 17. Observability and operations

Write failures are shown in the UI. Template origin metadata enables usage and migration reporting. Database revision snapshots are the audit trail for template definitions.

## 18. Acceptance criteria

1. A developer can create, edit, save, duplicate, rename, set fallback, and delete a non-fallback template.
2. Template search restores correctly from a shared URL.
3. Invalid templates show exact issues and cannot be selected for page creation.
4. Creating a page from a valid template produces a concept with copied blocks and fresh IDs.
5. Editing or deleting the template leaves the created page unchanged.
6. Quick-add uses the parent preference or site fallback without slug collisions.
7. Production builds allow authorized template mutation and reject unauthorized mutation requests.
8. Template creation and edits remain after reload and revision history records each save.

## 19. Edge cases

- Existing languages receive seeded definitions through the migration. A newly created language may start without templates until language initialization creates its defaults.
- A missing preferred template falls back to the language default and is shown as unavailable in page settings.
- A fallback template cannot be deleted directly.
- Unknown component definitions remain inspectable and repairable in the developer editor.
- Existing pages keep their historical origin key when a template is renamed or removed. Their optional template ID is cleared on template deletion.

## 20. Deferred work

- Template import and export workflows.
- Bulk migration of existing pages to a newer template revision.
- Template revision comparison and restoration.
- Schema package extraction and generated TypeScript types.
- Real consuming-site preview integration through the frontend SDK.

## 21. Open questions

- Whether template origin metadata should be exposed in administrative APIs.
- Whether template revisions need a richer authored changelog.
- Whether schema definitions should eventually be shared across sites through packages.

## 22. Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-07-15 | Templates are copy-on-create and never control existing pages. | Editors must retain full control and template changes must be safe. |
| 2026-07-15 | Definitions are language-scoped database records editable in production. | Editors need to manage starting points without a code deployment, while localized defaults remain isolated. |
| 2026-07-15 | Established languages have one published fallback template. | Page creation needs a deterministic valid starting point. |
| 2026-07-15 | Every save creates an immutable database revision snapshot. | Production editing needs an audit trail independent from source control. |
