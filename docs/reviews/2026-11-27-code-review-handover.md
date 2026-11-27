# Code review handover (2026-11-27)

- Status: Open
- Reviewed commit: `551c82a` (branch `main` at that commit)
- Not reviewed: the uncommitted live preview work that existed in the main checkout on the same date
  (ADR 0004, `docs/specs/live-preview.md`, `docs/specs/frontend-sdk.md`, `use-preview-bridge.ts`, and
  edits to the page editor). Findings about `page-editor-screen.tsx` and `preview-document.ts` may have
  shifted there. Re-check before fixing.

## How to use this document

This is a work list for an implementing agent or developer. It is grouped into work packages (WP).
Each package should be one branch and one pull request. Do them in order unless stated otherwise.

Confidence labels:

- **Verified**: the finding was read and traced in the source by two passes.
- **Reported**: read from code by one reviewer, not reproduced. Confirm before fixing.

Nothing in this review was executed against a database or exercised in a browser.

## Rules for the implementer

1. Read `AGENTS.md`, `SPEC_INDEX.md`, `PROJECT_HANDOFF.md`, `CONTRIBUTING.md` and
   `docs/architecture/frontend-structure.md` first.
2. Do not run `supabase db push` and do not change the hosted Supabase project. The migration ledger
   does not match the repository (see `PROJECT_HANDOFF.md`). Write new migration files only. Applying
   them is a separate, human-approved step.
3. Never edit an existing migration file. Add new ones.
4. For every bug fix, write a failing test first, then fix.
5. Before each pull request run: `pnpm generate-routes`, `pnpm lint`, `pnpm format:check`,
   `pnpm typecheck`, `pnpm test`, `pnpm build`.
6. Update the relevant spec, `SPEC_INDEX.md` and `PROJECT_HANDOFF.md` when behaviour changes. Record
   non-trivial choices as an ADR under `docs/decisions`.
7. Where a finding says "implement or remove", prefer removing or clearly disabling the UI unless the
   spec already defines the behaviour. Do not invent product behaviour. List open product questions in
   the pull request instead.
8. No em dashes in code, comments or docs.

## Baseline health on 2026-11-27

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`: pass.
- `pnpm test`: 220 tests. `tests/routes/editor.test.tsx` > "switches between the editable concept and
  read-only live version" is flaky. It failed 1 of 4 runs on the 5 second timeout.
- pnpm warns that the `pnpm` field in `package.json` is no longer read (overrides and
  `onlyBuiltDependencies`). Check that the chokidar override still takes effect with the pnpm version
  in use.

---

## WP1: Access control (new migration)

Goal: no privilege escalation inside a site, and the permission model in the UI is either enforced or
removed.

| # | Finding | Where | Confidence |
| - | ------- | ----- | ---------- |
| 1.1 | Any admin can set `sites.owner_id` to themselves, then delete the site or call `transfer_site_ownership`. The update policy covers all columns. `sites.owner_id` and `site_members.role = 'owner'` are two unconstrained sources of truth. | `20260721213000_site_settings.sql:161-165`, `20260712171000_harden_page_tree.sql:107-110` | Verified. **Fixed** (20261127120000): column grant blocks `owner_id`; deferred constraint trigger keeps `owner_id` and the single owner membership in step. |
| 1.2 | `access_scope`, `language_ids`, `branch_ids` and `sections` appear in no policy or function. A restricted member can edit everything through PostgREST. | `20260712171000_harden_page_tree.sql:54-69`, `20260721213000_site_settings.sql:9-22` | Verified. **Fixed**: scope and sections enforced in `private.has_language_access` / `has_page_access`, policies and wrapped functions. Open questions in `docs/specs/permissions.md`. |
| 1.3 | The `publisher` role is missing from `private.can_edit_language`, so publishers can do nothing, while `editor` can publish. There is no separate publish check. | same | Verified. **Fixed**: publishers can edit; `private.can_publish_page` gates page publish; record publish and schema publish need the publish capability. |
| 1.4 | Admins can insert a `site_members` row for any user id without consent, then read that user's email and last sign-in through `get_site_settings_workspace`. Invitations have no accept flow. | `20260721213000_site_settings.sql:167-173`, `:152-159`, `:505-522` | Reported. **Fixed** (confirmed by test): direct insert and update on `site_members` removed. No accept flow added; invitations stay pending. |
| 1.5 | The token update policy covers all columns: an admin can un-revoke a token, extend expiry, reset counters, raise the rate limit or swap the hash. The hash is supplied by the browser on insert. | `20260722200000_delivery_api.sql:311-315`, `src/lib/api-tokens.ts:95-110` | Reported. **Fixed** (confirmed): `create_site_api_token` / `revoke_site_api_token`; insert and update policies dropped. |
| 1.6 | Editors can update `pages` and `content_records` directly, so they can point `published_revision_id` at another page's or another site's revision. Direct writes to `status`, `slug`, `parent_id`, `site_language_id` and `concept_revision_id` bypass the invariants in `save_page_revision` and `move_page`. | `20260722200000_delivery_api.sql:12-13`, `:197-198`, `20260725143000_page_concept_revisions.sql:337-339` | Reported. **Fixed** (confirmed): composite FKs to `(id, page_id)` / `(id, record_id)`; column grants lock function-managed columns; insert policy forces concept pages. |
| 1.7 | Page tree cycles are possible: `update pages set parent_id = id` passes the trigger, and two concurrent `move_page` calls can create a cycle. Recursive CTEs have no cycle guard and then run until timeout. | `20260712165500_page_tree.sql:76-87`, `20260712224500_page_move_redirects.sql:43-50` | Reported. **Fixed** (confirmed for `parent_id = id`): check constraint, per-language advisory lock in trigger and `move_page`, `cycle` clauses. Concurrency not testable in PGlite. |
| 1.8 | Any authenticated user can insert orphan sites directly. The insert creates no membership but fires the seeding triggers. | `20260712171000_harden_page_tree.sql:96-99` | Reported. **Fixed** (confirmed): insert policy and grant removed; no `create_site` function, as nothing in `src` creates sites. |
| 1.9 | `pages.slug` and `sites.slug` have no format constraint. `a/b` or `../x` are accepted. | `20260712165500_page_tree.sql:22`, `20260725143000_page_concept_revisions.sql:179` | Reported. **Fixed** (confirmed): slug format check on pages and sites. Allows repeated inner hyphens, which the page editor slug field can produce. |
| 1.10 | The legacy three-argument `move_page` is still deployed and granted. It moves published pages without redirects. | `20260712213000_atomic_page_moves.sql:135-136` | Reported. **Fixed** (confirmed): dropped. |

Suggested fixes:

- Block changes to `owner_id` outside `transfer_site_ownership` (trigger or column grant). Derive
  ownership from one place.
- Put scope and section checks into the `private.can_*` helpers and add `private.can_publish`. If the
  permission spec (`docs/specs/permissions.md`) is not settled enough, remove the scope UI instead and
  record the open question.
- Remove the direct insert policy on `site_members`. Add members only through an invitation-accept
  function tied to the invitee's verified email, or disable inviting until that exists.
- Create and revoke tokens through SECURITY DEFINER functions that generate the secret server-side.
  Drop the insert and update policies.
- Composite foreign key `(published_revision_id, id)` to `(id, page_id)` for pages and records.
  Revoke direct update on the columns managed by functions.
- `check (parent_id <> id)`, a per-language advisory lock in `move_page` and the trigger, and a cycle
  guard in the recursive CTEs.
- Create sites only through a function that also inserts the owner membership.
- Add slug format checks matching the one on `content_types.slug`.
- Drop `public.move_page(uuid, uuid, text)`.

Tests: this package needs real database tests. See WP4. If WP4 is not done yet, add the local Postgres
test setup here first.

## WP2: Publishing integrity

Goal: what the delivery API serves matches what the editor intended.

| # | Finding | Where | Confidence |
| - | ------- | ----- | ---------- |
| 2.1 | There is no unpublish. Setting a record back to concept does not clear `published_revision_id`, and the bundle query ignores `status` for records and pages. Editing a published record publishes instantly. | `20260722200000_delivery_api.sql:266-271`, `:411-414`, `:437-440`, `src/lib/structured-content-data.ts:198-209` | Verified |
| 2.2 | The page path is frozen in the published snapshot. After `move_page` the page and its descendants are still delivered at the old path while a redirect points to a new path that resolves to nothing. A slug change through `save_page_revision` leaves descendants stale and creates no redirect, although the UI says it does. | `20260725143000_page_concept_revisions.sql:30`, `20260712224500_page_move_redirects.sql:152-162`, `src/domain/delivery.ts:320`, `src/features/page-editor/components/settings-tab.tsx:43` | Verified |
| 2.3 | Moving a page A to B and back leaves redirects A to B and B to A. A third move hits the unique constraint and aborts with a raw error. | `20260712224500_page_move_redirects.sql:152-162` | Reported |
| 2.4 | `publish_content_type_schema` is never called from `src`. Content types created in the admin never reach REST or GraphQL, and field changes to older types are never published. | `20260722200000_delivery_api.sql:122`, `:445`, `src/lib/structured-content-data.ts:266` | Verified |
| 2.5 | Only `saveEditablePage` goes through the revision function. `renamePage` writes the live row directly. There are two delete functions with different guards. Navigation publish is a plain client update with the browser clock and no history. | `src/lib/page-tree.ts:205-212`, `src/lib/page-editor.ts:293-298`, `src/lib/navigation.ts:152-170` | Reported |
| 2.6 | Navigation items of type "page" store the path string, not the page id. A move or slug change breaks menus. `parseItems` silently drops invalid items and the next save persists the loss. `loadNavigationWorkspace` inserts a row on read. | `src/lib/navigation.ts:51-53`, `:86`, `:108-113`, `src/features/navigation/components/menu-card.tsx:235` | Reported |
| 2.7 | Reparenting a published leaf page changes its URL with no review dialog and `createRedirects: false`. | `src/features/page-tree/page-tree-screen.tsx:560-568` | Reported |
| 2.8 | The SEO tab says problems must be resolved before publishing, but Publish is never blocked. The problem rules exist twice and differ. The server trusts the client's `target_validation_status`. | `src/features/page-editor/components/seo-tab.tsx:21`, `editor-toolbar.tsx:121-123`, `page-editor-screen.tsx:172-183`, `src/lib/page-editor.ts:232-241` | Reported |
| 2.9 | Page creation checks slug uniqueness with read-then-insert. The 40001 conflict from `save_page_revision` has no handling in the UI. | `src/lib/page-tree.ts:171-180` | Reported |

Suggested fixes:

- Add explicit unpublish functions for pages and records that null `published_revision_id`. Filter
  the bundle on status as defence in depth. Decide with the spec whether records get a concept stage.
- Compute delivered paths at read time from the live tree of published pages, or re-snapshot the
  subtree inside `move_page` and on slug change. Record the choice as an ADR.
- Upsert redirects and delete any redirect whose source equals a live path.
- Call the schema publish function when a content type is saved (or fold it into the save function).
- Route every content mutation through SQL functions that own revisioning, guards and timestamps.
- Store `pageId` in navigation items and resolve the path at delivery. Report invalid items instead of
  dropping them.

## WP3: Delivery API

| # | Finding | Where | Confidence |
| - | ------- | ----- | ---------- |
| 3.1 | Token-gated responses are sent with `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` and no `Vary: Authorization`. Responses without an `Origin` header carry no `Vary: Origin`. | `src/lib/delivery-api.server.ts:78-88`, `:113-117` | Verified |
| 3.2 | The admin stores language prefixes as `nl/`, the resolver expects `nl`. Non-default languages 404 in `pages/resolve` and GraphQL `page(url:)`. Tests on each side use a different format, so both pass. No database constraint. | `src/features/site-settings/languages-settings.tsx:52`, `src/domain/delivery.ts:313-318` | Verified |
| 3.3 | GraphQL non-null types are derived from unvalidated data. One record or block with a missing required value, or a number field stored as `""`, turns the whole response into `data: null`. | `src/lib/delivery-graphql.server.ts:72`, `:171`, `:421-429`, `:463`, `src/lib/structured-content.ts:75` | Reported |
| 3.4 | Generated type and field names are not namespaced. A content type with slug `page` creates a second `PageConnection` and every GraphQL request for that site returns 500. A field keyed `id`, `locale`, `revisionId` or `publishedAt` replaces the system field. | `src/lib/delivery-graphql.server.ts:450-470`, `:559-584` | Reported |
| 3.5 | `get_delivery_bundle` is executable by `anon` and trusts the caller-supplied token hash and origin. Calling the RPC on Supabase directly with `target_origin: null` bypasses the origin allowlist, and a leaked hash is directly usable. | `20260722200000_delivery_api.sql:350-354`, `:479-480`, `src/lib/delivery-api.server.ts:45-55` | Reported |
| 3.6 | Every request builds the whole site in Postgres, ships it to the app server and filters in memory. Each read also updates the token row. The GraphQL schema is rebuilt per request. The ETag is computed after all the work. | `20260722200000_delivery_api.sql:356-473`, `src/lib/delivery-rest.server.ts:32`, `src/lib/delivery-graphql.server.ts:651` | Reported |
| 3.7 | Error status is chosen by regex on the Postgres message. Every other upstream failure becomes 401 invalid token. Malformed percent sequences, invalid `variables` JSON and bad URLs return 500. The 100 kB limit only reads `content-length`. | `src/lib/delivery-api.server.ts:58-73`, `src/lib/delivery-rest.server.ts:13`, `src/lib/delivery-graphql.server.ts:594`, `:622`, `:626`, `src/domain/delivery.ts:307-312` | Reported |
| 3.8 | REST and GraphQL disagree: lists are stored as pipe-delimited strings that REST returns raw and GraphQL parses; `Site` and `Page` expose different fields; `content-types/{slug}` returns an array; unknown slug on `/records` returns 200; 405 has no `Allow`; invalid cursors silently restart; cursors are offsets; the site key is the editable slug; `routeSegments` hard-codes `slice(4)`. | `src/lib/delivery-rest.server.ts:37-102`, `src/lib/delivery-graphql.server.ts:191-196`, `:372-381`, `src/domain/delivery.ts:323-333` | Reported |
| 3.9 | The stored token prefix is exactly the constant `scaffold_pub_`, so it identifies nothing. | `src/lib/api-tokens.ts:95` | Verified |
| 3.10 | Introspection is on in production. Depth and field limits count the document before fragment expansion. | `src/lib/delivery-graphql.server.ts` | Reported |

Suggested fixes:

- Decide whether published content is public. If tokens stay, use `private` or always send
  `Vary: Authorization, Origin`. Record the caching model as an ADR, since the architecture overview
  lists it as undecided.
- Pick one prefix format, enforce it with a check constraint, and normalise in `parseDeliveryBundle`.
- Make content and block fields nullable in GraphQL, or validate against the published schema at
  publish time. Namespace generated types and reject reserved field keys.
- Hash the raw token inside the SQL function. Either accept that origin is advisory, or call the RPC
  with a server-only credential and revoke `anon`. If a server-only key is introduced, make sure it
  can never reach the client bundle.
- Map errors on the SQLSTATE code. Wrap input parsing in 400 responses.
- Per-resource functions with SQL-side pagination, or cache the bundle per site keyed on a publish
  version. Move rate limiting off the token row.
- Add handler tests with a stubbed `fetch` for auth, CORS, caching, error mapping and routing. None
  exist today.

## WP4: Migrations, seed data, types and database tests

| # | Finding | Where | Confidence |
| - | ------- | ----- | ---------- |
| 4.1 | The migration chain cannot be replayed on a fresh database: one migration hard-codes site slug `site-b562e3a7fd91` and raises if it is missing. | `20260728152000_publish_marketing_homepage_blocks.sql:152-159` | Verified |
| 4.2 | Data migrations rewrite tenant content: every page with slug `product-launch` on every site is overwritten; the rebrand does text replacement in all tenants' content and snapshots; demo pages are inserted into existing sites. | `20260712183000_page_editor_content.sql:12-26`, `20260725120000_rebrand_scaffold_cms.sql:14-48`, `20260712165500_page_tree.sql:222-309` | Verified (slug and site key), rest Reported |
| 4.3 | Some statements are not idempotent (`add constraint` and `create policy` without guards). | `20260712183000_page_editor_content.sql:8-10`, `20260712224500_page_move_redirects.sql:20-35`, `20260721213000_site_settings.sql:224-269` | Reported |
| 4.4 | Every new language is seeded with published demo colleagues (names, emails, phone numbers) that go out through the delivery API. | `20260715110000_structured_content.sql:305-312`, `:364-367` | Reported |
| 4.5 | `src/lib/database.types.ts` is hand-written. There is no generation script and no `supabase/config.toml`. Gaps are closed with casts. | `src/lib/database.types.ts:130`, `:581-589`, casts in `page-tree.ts:128`, `:252`, `page-editor.ts:212`, `:247`, `:269`, `navigation.ts:156`, `structured-content-data.ts:111` | Reported |
| 4.6 | No SQL function, RLS policy or trigger is executed by any test. `tests/migrations/` only asserts that the SQL text contains substrings. | `tests/migrations/*` | Verified. **Done in WP1**: `tests/database/` with PGlite, see ADR 0005. |

Suggested fixes:

- Existing migrations cannot be edited, and the hosted ledger is already out of line. Propose a
  baseline: one squashed schema-only migration that reproduces the current schema, plus
  `supabase/seed.sql` for demo and marketing content. Do not apply it to the hosted project. Write the
  proposal as an ADR and leave the ledger reconciliation as a human step.
- Stop seeding published demo people into new sites.
- Add `supabase/config.toml`, generate types with `supabase gen types`, and fail CI on a diff.
- Add database tests (pgTAP or a local Supabase test database) that replay the migrations and
  exercise RLS and the main functions. WP1 and WP2 depend on this.

## WP5: Editor safety and data flow

| # | Finding | Where | Confidence |
| - | ------- | ----- | ---------- |
| 5.1 | The page editor and navigation editor refetch and overwrite the draft whenever the `user` object identity changes, which happens on every auth event including token refresh. | `src/lib/auth.tsx:58-63`, `:96`, `src/features/page-editor/page-editor-screen.tsx:70-91`, `src/features/navigation/navigation-editor.tsx:76-93` | Verified (dependency), frequency not measured |
| 5.2 | No unsaved-changes guard in the page editor, navigation editor or template editor. "Discard concept" has no confirmation. A module-level Map caches the unsaved page and is later overwritten by the fetch. "All changes saved" is set even if the user typed during the save. | `page-editor-screen.tsx:24`, `:93-95`, `:303`, `navigation-editor.tsx:276`, `page-template-editor.tsx:186`, `version-context-bar.tsx:57-64`, `use-page-versions.ts:84` | Verified (no blocker exists), rest Reported |
| 5.3 | The site and language selection is local to each screen. Navigation and structured content always load the first site and default language. | `page-tree-screen.tsx:168`, `:485-490`, `redirects-screen.tsx:60`, `:252-256`, `page-templates-screen.tsx:266`, `navigation-editor.tsx:79`, `src/lib/structured-content-data.ts:127-147` | Reported |
| 5.4 | Password reset is a dead end. The link goes to `/auth?mode=reset`, which the auth screen does not handle. The user is signed in without setting a password. | `src/lib/auth.tsx:133`, `src/features/auth/auth-screen.tsx:19-27`, `src/routes/auth.tsx` | Verified |
| 5.5 | Seven screens hand-roll fetch-in-effect with no cancellation. Quick workspace switches race. Three module-level caches are never invalidated. Every site settings save unmounts the whole subtree. A corrupt sessionStorage entry shows "Could not load pages". | `page-tree-screen.tsx:39`, `:241-287`, `redirects-screen.tsx:21`, `:89-107`, `page-templates-screen.tsx:75-93`, `site-settings-screen.tsx:68` | Reported |
| 5.6 | The auth guard is duplicated and inconsistent. Structured content shows the splash forever when signed out. Redirects ignores auth loading. Routes have no `beforeLoad`. | `app-shell.tsx:59-62`, `structured-content-screen.tsx:169`, `redirects-screen.tsx:55`, `:258-259` | Reported |
| 5.7 | Updates and deletes without `.select()` report success when RLS filtered the row out. Most serious for `revokeSiteApiToken`. | `src/lib/page-tree.ts:210`, `src/lib/api-tokens.ts:106-110`, `src/lib/site-settings.ts:196-205`, `:232-236`, `:298-302` | Verified (pattern) |
| 5.8 | `/editor` without `?page=` loads whichever page has the demo slug `product-launch`. A test asserts this. Ancestors are loaded with one query per level. | `src/lib/page-editor.ts:129`, `:182-196`, `tests/lib/page-editor.test.ts:112` | Verified |
| 5.9 | No query paginates. With the default row cap the tree, records and redirects truncate silently, and `buildTree` drops pages whose parent is missing or that sit in a cycle without reporting it. | `src/lib/page-tree.ts:66-67`, `:89`, `:120-126`, `src/lib/structured-content-data.ts:129-176`, `src/lib/redirects.ts:88-92` | Reported |
| 5.10 | Preview iframes are same-origin `srcDoc` without `sandbox`. Block ids are not escaped. Messages are accepted without checking `event.source`, and `postMessage` targets `"*"`. | `page-editor/components/preview-pane.tsx:71-80`, `page-editor/preview-document.ts:45`, `page-templates/preview-document.ts:2`, `page-editor-screen.tsx:105-112`, `page-template-editor.tsx:71-75`, `:264-269` | Verified (no sandbox), rest Reported. Re-check against ADR 0004. |

Suggested fixes:

- Introduce one data-fetching approach (TanStack Query or route loaders; record the choice as an ADR)
  with keyed queries and invalidation. Delete the module-level Maps.
- Depend on `user?.id`, never replace a dirty draft from a background refetch.
- One `useUnsavedChangesGuard(dirty)` hook (router blocker plus `beforeunload`). Confirm discard.
- One workspace source of truth (URL search param or a persisted context) passed to every loader.
- Handle `mode=reset` or the `PASSWORD_RECOVERY` event with a set-password form.
- One `_authenticated` layout route with `beforeLoad`.
- A shared mutation helper that selects the affected row and fails when nothing changed.
- Return null without a page id. Load ancestry in one call.
- `sandbox="allow-scripts"` without `allow-same-origin`, escape ids, compare `event.source` to the
  iframe window.

## WP6: One domain model

| # | Finding | Where | Confidence |
| - | ------- | ----- | ---------- |
| 6.1 | `src/domain` contains one file, used only by the delivery handlers. The rules the docs assign to the domain live in `src/lib` next to Supabase calls, in React and in SQL. | `src/domain/delivery.ts` | Verified |
| 6.2 | The block model is defined five times with different contents. The image block has no image field in the editor or in GraphQL. GraphQL `CtaBlock.button` matches no registry field. Template cloning copies non-string values that `parseBlock` then drops. | `src/domain/delivery.ts:3-13`, `:153-157`, `src/lib/page-editor.ts:4-15`, `src/lib/page-templates.ts:75-301`, `:403-409`, `src/features/page-editor/editor-model.ts:26`, `src/lib/delivery-graphql.server.ts:143-290` | Reported |
| 6.3 | Path building exists in five places with different homepage rules. Slugify exists three times and is ASCII only ("Über uns" becomes `ber-uns`). Site and language selection is copied in two loaders. | `src/lib/page-tree.ts:54`, `:97-119`, `:151-158`, `src/lib/page-editor.ts:198-200`, `src/domain/delivery.ts:298`, `src/lib/redirects.ts:32`, `src/lib/structured-content-data.ts:234`, `src/lib/page-templates.ts:316`, `src/lib/page-templates-data.ts:121-139` | Reported |
| 6.4 | Lists are stored as pipe-delimited lines. | `src/lib/delivery-graphql.server.ts:191-196` | Reported |
| 6.5 | `relativeTime` bakes English strings into the model at load time. `page-templates-data.ts` invents timestamps and ids on every load. `getRedirectHealth` rebuilds the redirect map per row. | `src/lib/structured-content-data.ts:57-70`, `src/lib/page-templates-data.ts:57`, `:85`, `src/lib/redirects.ts:45` | Reported |

Suggested fixes:

- One block schema module in `src/domain` that the editor, template registry, delivery parser and
  GraphQL builder derive from. Store lists as JSON arrays (needs a data migration and an ADR).
- Move pure rules (paths, slugs with `normalize("NFKD")`, validation, redirect health) into
  `src/domain`, each defined once and unit tested.
- Extend the architecture test or add an ESLint import-boundary rule so `src/lib` is covered.

## WP7: UI code quality

Do this after WP5, because the shared data hooks change the shape of every screen. Use
`src/features/site-settings/**` as the style reference. Pilot on the page tree, then apply the same
pattern to the other seven baselined screens, one pull request per screen.

Structure:

| # | Finding | Where | Confidence |
| - | ------- | ----- | ---------- |
| 7.1 | Tailwind is used as inline CSS: 7,005 arbitrary-property utilities such as `[display:flex]`, about 500 idiomatic utilities, 4,610 descendant selectors such as `[&_label>span]:`, 140 distinct hex colours despite tokens in `src/styles.css`. 369 lines in feature files are wider than 200 characters. | `src/features/**` | Verified (counts) |
| 7.2 | The `sc-action` button class string (700 to 911 characters) appears 35 times in 9 files. `ui/button.tsx` has cva variants, but 195 uses pass `unstyled`. | `src/components/ui/button.tsx`, for example `page-tree-screen.tsx:700` | Verified |
| 7.3 | 406 `sc-*` class names have no CSS rules. They survive as test hooks. | `tests/routes/media.test.tsx:80` and others | Reported |
| 7.4 | `page-tree-screen.tsx` is one component with 37 `useState`/`useRef` calls holding tree helpers, loader, filters, create, drag and drop, move, rename, delete, a 400-line row render, four modals and a private toast. Eight baselined files hold about half the feature code. | `src/features/page-tree/page-tree-screen.tsx`, `tests/source-architecture.test.ts:29-38` | Verified |
| 7.5 | Duplicated blocks: private toast in 7 files while sonner is mounted; cache plus load plus workspace switch in 3 screens; clickable row with nested actions in 5; popover row menu in 2; device switcher and fake URL bar in 3; modal header, body and footer many times; three dialog implementations. | see lines in the review notes below | Reported |

Target split for the page tree:

- `tree-model.ts`: flatten, filter, move impacts, quick-create naming. Unit tested.
- `use-page-tree-workspace.ts`: load and mutations.
- `use-tree-view-state.ts`: expanded, selected, session restore.
- `use-page-drag.ts`.
- `PageTreeToolbar`, `PageTreeFilters`, `PageTreeRow` (memoised), `PageRowMenu`.
- `AddPageDialog`, `RenamePageDialog`, `DeletePageDialog`, `MoveImpactDialog`, each owning its form
  and error state.
- Sonner for toasts. The coordinator should end near 150 lines.

Shared pieces to build once: Button variants (delete `unstyled`), `Field`, `Toolbar`, one dialog, one
row menu, a workspace switcher, a device preview frame. Remove each baseline from
`tests/source-architecture.test.ts` when its screen is done. Replace `sc-*` test hooks with roles and
labels.

Duplicate locations: toasts at `page-tree:492`, `structured-content:138`, `navigation-editor:95`,
`redirects:115`, `page-editor-screen:166`, `media:299`, `personal-settings:112`; row menus at
`page-tree:982-1040`, `page-templates-screen:449-508`; device bar at `preview-pane:35-57`,
`page-template-editor:228-251`, `navigation-editor:328-353`; modals at `page-tree:1250-1348`,
`redirects:514-672`.

Accessibility:

| # | Finding | Where | Confidence |
| - | ------- | ----- | ---------- |
| 7.6 | Row-level `onKeyDown` cancels Enter and Space for nested buttons, so keyboard users cannot use row actions. | `page-tree-screen.tsx:853-858`, `structured-content-screen.tsx:526-530`, `page-templates-screen.tsx:385-389`, `page-editor/components/content-tab.tsx:55-60`, `page-template-editor.tsx:365-373` | Verified (page tree) |
| 7.7 | The tree has `role="treeitem"` rows without a `role="tree"` parent, `aria-expanded` or arrow keys. Reordering is mouse drag only. Icon buttons lack `aria-label`. | `page-tree-screen.tsx:822-878`, `menu-card.tsx:95-129`, `content-tab.tsx:69-100`, `media-screen.tsx:352-366`, `:442-448`, `:534` | Reported |
| 7.8 | Hand-rolled overlays lack focus trap and Escape. A backdrop click discards the record draft silently. Row menus have no outside-click dismissal. Read-only mode is `pointer-events:none` with focusable inputs. | `structured-content-screen.tsx:622-699`, `editor-overlays.tsx:28-57`, `media-screen.tsx:640-689`, `editor-panel.tsx:86` | Reported |
| 7.9 | `<label>` wraps whole field widgets, so clicking label text activates the first control inside (removes a tag, sets a fake image). Only the primary field is validated although `required` renders a star. | `structured-content-screen.tsx:784-810`, `:206-211` | Reported |

Bugs:

| # | Finding | Where | Confidence |
| - | ------- | ----- | ---------- |
| 7.10 | Template component drag and drop is off by one when dragging downward, and removes the last component if the source is not found. | `page-template-editor.tsx:116-119` | Verified |
| 7.11 | A brace-less `if` makes the `body` wrapper apply to every block type in the preview. The script is patched with `.replace()` on its own literal. | `page-editor/preview-document.ts:20-27`, `:48-58` | Verified (braces). Re-check against the live preview work. |
| 7.12 | `modalError` is shared by four modals and not cleared. Private toasts show a success icon for failures. `navigation-editor.tsx` reads a value assigned inside a state updater. `window.confirm` is used next to real dialogs. App shell nav items are buttons, not links. Every user is labelled "Owner". | `page-tree-screen.tsx:392-401`, `:1449`, `navigation-editor.tsx:163-182`, `structured-content-screen.tsx:366`, `app-shell.tsx:146-180` | Reported |

Fake or half-wired UI (implement per spec, or show a clear "not connected" state; never show a success
toast for a no-op):

- Media: seed data in state, "URL copied" without copying, upload and download are toasts
  (`media-screen.tsx:29-233`, `:619`).
- Structured content: image field sets `selected-image.jpg` (`:829`), rich-text toolbar has no
  handlers (`:866-876`), reference fields are plain selects (`:840`).
- Templates: toolbar and media default button without handlers (`template-field-editor.tsx:61-115`).
- Page editor: hard-coded translations (`settings-tab.tsx:108-130`), `acme.com`
  (`preview-pane.tsx:55`, `seo-tab.tsx:75`), byline "By Mara Jensen" (`preview-document.ts:48`), "Open
  preview" toast (`page-editor-screen.tsx:325`), social image stub (`seo-tab.tsx:63-66`).
- Navigation: "Open preview" without handler (`navigation-editor.tsx:363`), refresh only spins
  (`:233-236`), domain is `{slug}.com` (`:350`).
- Site settings: avatar literal and "Replace" without handler (`general-settings.tsx:76-82`), export
  queue with no worker (`advanced-settings.tsx:120`), domain verify only sets pending
  (`src/lib/site-settings.ts:297-303`), invitations only insert a row.
- Page tree: validation badge count is a literal `1` (`page-tree-screen.tsx:928`).
- `seedStructuredTypes` is 280 lines of demo data referenced only by a test
  (`src/lib/structured-content.ts:89-371`).

Performance:

- The page editor regenerates `srcDoc` on every render, reloading the iframe per keystroke
  (`page-editor-screen.tsx:289`). Post block data into a static document instead. Re-check against the
  live preview work.
- Search inputs navigate per keystroke without debounce (`page-tree-screen.tsx:235`,
  `redirects-screen.tsx:86`, `structured-content-screen.tsx:466`, `media-screen.tsx:277`).
- Tree rows are unmemoised and unvirtualised. `visibleExpanded` is a new Set every render
  (`page-tree-screen.tsx:371`). The scroll listener writes sessionStorage on every event (`:301-312`).
- `@apollo/sandbox` is imported statically into the settings route (`graphql-playground.tsx:1`).
- Phosphor icons load as three render-blocking stylesheets from unpkg (`src/routes/__root.tsx:25-36`).
  Self-host them.

## WP8: Tests and tooling

| # | Finding | Where | Confidence |
| - | ------- | ----- | ---------- |
| 8.1 | The Supabase mock returns the next queued value whatever filters are applied, so a wrong filter cannot fail a test. Fixtures violate database constraints. | `tests/helpers/supabase-mock.ts:46-60`, `:101-105`, `tests/lib/page-tree.test.ts:67`, `:165-176` | Verified (mock) |
| 8.2 | Route tests mock the router, auth, data modules, app shell and dialogs, and use `fireEvent` only. Some assert mocked markup or lock stub toasts in as behaviour. One dispatches preview messages from `window`, which only works because the source check is missing. | `tests/routes/index.test.tsx:21-70`, `:261`, `simple-routes.test.tsx:22-60`, `media.test.tsx:84-87`, `editor.test.tsx:215-223`, `tests/components/page-template-editor.test.tsx:64-65` | Reported |
| 8.3 | Coverage thresholds in `vitest.config.ts` are never enforced: CI runs `pnpm test`, not `pnpm test:coverage`. | `.github/workflows`, `vitest.config.ts:14-19` | Verified |
| 8.4 | The flaky editor test listed under baseline health. | `tests/routes/editor.test.tsx` | Verified |
| 8.5 | The size test freezes eight exceptions. The import checks are regexes that only match alias imports and do not cover `src/lib`. The styling contract mostly asserts that deleted files stay deleted. | `tests/source-architecture.test.ts:29-38`, `:85-98`, `tests/styling-contract.test.ts` | Reported |
| 8.6 | Unused dependencies: `@tanstack/react-devtools`, `@tanstack/react-router-devtools`, `@tanstack/react-router-ssr-query`, `@tanstack/router-plugin` (confirm with a grep before removing). `shadcn` is a runtime dependency for one CSS import. Build tools sit in `dependencies`. The `#/*` alias is unused. `.cta.json` is scaffold residue. | `package.json`, `src/styles.css:34` | Reported |
| 8.7 | `personal-settings.ts` saves email, profile and metadata in three unrelated calls, leaving partial state on failure. | `src/lib/personal-settings.ts:61-84` | Reported |

Suggested fixes: a fake data layer that honours filters, a real memory router in route tests,
`userEvent` with keyboard paths, coverage in CI, an ESLint import-boundary rule in place of the regex
checks.

## What is solid (keep it)

- RLS is enabled on every table. No `using (true)`, no policy for `anon`, helpers live in a
  non-exposed `private` schema.
- SECURITY DEFINER functions pin `search_path` and check authorization inside. No dynamic SQL.
- No service-role key anywhere. `.env.example` has placeholders only.
- Tokens: 256-bit random secret, SHA-256 stored, shown once, expiry and revocation checked in SQL,
  uniform errors so site keys cannot be enumerated, rate limiting in the database.
- Draft page content does not leak: delivery reads immutable published snapshots.
- `save_page_revision` uses a row lock plus an expected-revision check.
- One homepage per language, unique sibling slugs, one default language, one fallback template and
  one primary domain are enforced by partial unique indexes.
- Routes are thin with validated search params. Filters live in the URL.
- Server JSON is parsed with explicit guards rather than cast wholesale.
- Strict TypeScript with `noUncheckedIndexedAccess`, type-checked ESLint, no `any`.
- `src/features/site-settings/**` is the model for component size, styling and testing.
