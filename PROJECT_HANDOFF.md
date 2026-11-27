# Project handoff

- Last updated: 2026-11-27
- Project stage: Functional proof of concept

## What this project is

Scaffold CMS is an open-source, headless CMS focused on real website workflows. It aims to replace the disconnected collection-first mental model of many headless CMS products with a canonical page tree that ordinary website editors can understand.

The CMS will serve content through REST and GraphQL. Consuming websites remain responsible for rendering.

## Current state

- The product name is **Scaffold CMS**. Administration copy, package metadata, documentation,
  preview/theme namespaces, delivery problem URIs, demo content, and newly issued publishable token
  prefixes use the Scaffold name.
- A TanStack Start administration application is implemented and builds successfully.
- Supabase authentication and database persistence support the proof of concept.
- Page tree, page editor, media flow, redirects, navigation, structured content, and personal settings have working UI flows.
- The Page Editor block catalog now includes hero, rich text, quote, image, CTA, metrics, steps,
  feature, published-page list, and FAQ blocks. Marketing blocks keep scalar persisted values for
  simple editing while GraphQL exposes strongly typed repeated-item lists. The standalone Next.js
  marketing website renders its published homepage in block order with no authorable marketing copy
  left hard-coded in the website.
- The Page Editor persists every explicit concept save as an immutable page revision, rejects stale
  concurrent saves, keeps the selected published snapshot live until explicit publication, and can
  switch to or restore the read-only live version. Autosave and arbitrary revision-history browsing
  remain deferred.
- Page templates are implemented as language-scoped database definitions with production editing, draft/published lifecycle, revision history, validation, fallback selection, usage reporting, and copy-on-create page creation.
- Site Settings has a Supabase-backed Tailwind implementation covering General, People & access, Languages, Domains & preview, and Advanced. It includes URL-restorable navigation, real accounts and memberships, role presets, scoped access, responsive layouts, persisted invitations, guarded ownership transfer and deletion, domain verification requests, and queued exports. RLS limits settings mutations to owners and administrators and limits other roles to a conservative view of their own access. Invitation delivery/acceptance, DNS verification, export generation, and the final formal permission contract remain unresolved.
- Administration source is feature-first. Every TanStack route is a thin typed adapter importing a feature through its public `index.ts`; the Page Editor is split into focused coordinator, model, preview, toolbar, panel, tab, and overlay modules, while navigation separates tree operations, cards, and previews. Remaining oversized proof-of-concept coordinators have explicit no-growth baselines.
- Tailwind CSS 4 is the administration styling system across the complete UI: authentication, loading states, app shell, Page Tree, Page Editor, Media, Redirects, Header Navigation, Footer, Structured Content, Page Templates, Personal Settings, Site Settings, shared dialogs, controls, and toasts. Route-owned stylesheets have been removed; `src/styles.css` now contains only the runtime theme, global element foundations, Tailwind theme registration, and shared keyframes imported from `src/animations.css`.
- The product vision and initial architecture are documented.
- Page-tree product discovery is complete enough for a working specification.
- Versioned REST and strongly typed GraphQL delivery APIs are implemented as token-gated TanStack
  server routes. They share a framework-neutral delivery model and expose published page/content
  snapshots, public site/language data, navigation, and redirects. Media remains empty because its UI
  has no persisted domain model yet.
- Site Settings includes an API access destination for site-owned publishable read tokens with one-time
  secret display, hashed storage, optional expiry and browser origins, last-used tracking, rate limits,
  and revocation. It also includes a site-scoped Apollo Sandbox embed with schema introspection,
  autocomplete, query building, response inspection, and a preconfigured hosted-Sandbox link;
  playground tokens remain in page memory and are never placed in external URLs. Confidential preview
  tokens and draft reads remain deferred.
- Access control (review WP1) is enforced in the database by migration
  `20261127120000_access_control.sql`: role presets including Publisher, access scopes, product
  sections and a separate publish capability; ownership tied to one owner membership; memberships and
  sites no longer insertable from the browser; API tokens generated, hashed and revoked by database
  functions; function-managed page and record columns locked; no page-tree cycles; URL-safe slugs; the
  legacy three-argument `move_page` removed. See [Permissions](docs/specs/permissions.md). **This
  migration is committed but not applied to the hosted project.**
- Database behaviour is tested: `tests/database/` replays every migration into in-process PGlite and
  runs RLS, grants, functions and triggers as different users (ADR 0005).
- No production deployment target has been selected.

## Start here on a new machine

For a disposable local database (Docker), see [docs/SETUP.md](docs/SETUP.md): `pnpm db:start`,
`pnpm db:reset`, `pnpm dev:local`.

```bash
git pull
pnpm install
pnpm generate-routes
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Then read, in order:

1. [Specification index](SPEC_INDEX.md)
2. [Page tree specification](PAGE_TREE_SPEC.md)
3. [Product vision](docs/product/vision.md)
4. [Architecture overview](docs/architecture/overview.md)
5. [Architecture decisions](docs/decisions/README.md)

Also inspect `git status` before editing. Uncommitted work may belong to another session or machine.

## Confirmed product decisions

- The CMS is open source and headless.
- It provides REST and GraphQL APIs.
- It supports multiple sites.
- Every site language has an independent canonical page tree.
- Pages in different languages may be linked as translations without requiring matching structures.
- The canonical page tree controls URL structure, not visible header or footer navigation.
- Every language tree has one protected homepage.
- Pages are universal objects; News, Blog, and Landing are templates rather than rigid page types.
- Templates copy initial content into a page and have no continuing control over it.
- Any page may appear beneath any other page if the URL structure remains valid.
- Structural changes show every affected URL and create redirects for changed published URLs.
- A parent with children cannot be deleted until its children are moved.
- Previously published pages may be deleted without a redirect after an explicit choice.
- Every explicit save creates a permanent revision row.
- Autosave uses a separate temporary working copy.
- Editing published content leaves its current published revision live until the concept is published.
- Permissions must support site, language, subtree, and action scopes.
- Templates are edited by authorized users in production and stored in Supabase with immutable revision snapshots.
- Delivery requests require a site-owned publishable token and explicitly identify the site by stable key.
- REST and GraphQL use one universal Page type; templates do not create frontend API types.
- The shared schema and field registry is still code-defined and must be hardened before it becomes production-editable.

## Technical direction

- TanStack Start powers the initial administration application and early server layer.
- CMS domain logic must remain independent of React and TanStack.
- PostgreSQL is the intended first database.
- S3-compatible storage is the intended media-storage abstraction.
- Consuming websites must not be required to use React or TanStack.
- Administration styling uses Tailwind CSS 4 with CSS-first semantic tokens and local Base UI primitives. Tailwind remains outside the CMS domain and does not constrain consuming websites.

These are current directions, not permission to choose unrecorded libraries for authentication, database access, GraphQL, rich text, or migrations.

## How future Codex sessions should work

When asked to brainstorm or specify a feature:

1. Read the relevant existing specifications.
2. Identify contradictions and missing decisions.
3. Ask focused questions one at a time when the user prefers a conversational flow.
4. Reflect each answer back as concrete requirements.
5. Write or update the feature specification after the foundational questions are resolved.
6. Update [SPEC_INDEX.md](SPEC_INDEX.md) and this handoff when the project state changes materially.

When asked to implement a feature:

1. Confirm its specification is ready for implementation.
2. Surface unresolved decisions that materially affect the implementation.
3. Keep framework code outside the domain model.
4. Add tests proportionate to the behaviour and risk.
5. Run route generation, type checking, tests, and a production build.
6. Update the relevant specification and handoff with what actually changed.

## Known toolchain notes

- The project uses pnpm's `use-node-version` setting to ensure commands run under Node 22.19.
- Chokidar is constrained to version 4 because the generated Router CLI CommonJS watcher was incompatible with Chokidar 5 at project creation time.
- TanStack package versions are deliberately pinned while the framework remains close to its 1.0 transition.
- Styling architecture is recorded in ADR 0002. Do not add new feature-to-feature stylesheet imports or duplicate light/dark token sets; use the semantic utilities in `src/styles.css`.
- Tailwind class ordering is enforced by `prettier-plugin-tailwindcss`; the styling contract test prevents route-owned CSS from being reintroduced.
- ESLint keeps imports at the top of TypeScript modules, requires one declaration per statement, and enforces semantic padding around block statements and returns. Architecture size limits count non-empty lines so readability spacing is not penalized.
- Vitest files live under the top-level `tests/` directory, mirroring `src/`; source imports in tests use the `@/` alias, and the test-layout contract prevents test files from being colocated under `src/`.
- The feature-first route migration documented in `docs/architecture/frontend-structure.md` is complete. Shared UI remains feature-neutral; new routes are limited to 150 lines and new React modules to 350 lines; existing feature-screen exceptions may shrink but cannot grow.
- Database tests use PGlite pinned to `0.3.16` (PostgreSQL 17.5). Keep its major version close to the
  hosted project. PGlite ignores `statement_timeout`, so an unguarded infinite recursive query hangs
  the test run rather than failing.
- GitHub Actions runs formatting, linting, type checking, tests, route generation, and the production build for pushes to `main` and pull requests.
- The linked hosted Supabase project contains migration-history versions that do not match several local migration filenames. Site Settings migration `20260721213000` was applied directly through the linked Management API on 2026-07-21. Delivery migration `20260722200000_delivery_api.sql` was applied through the project-scoped Supabase MCP on 2026-07-22 and recorded remotely as version `20260722132018`, name `delivery_api`. Before using a future blanket `supabase db push`, reconcile the history through schema comparison; do not blindly replay or repair those entries.
- Marketing homepage migration `20260728152000` was applied through the same isolated CLI migration
  view on 2026-07-28. It created new concept and published homepage revisions containing the complete
  ordered marketing block set.

## Hosted Supabase migration audit (2026-11-27)

The SiteFoundry project was resumed. The hosted database matched a fresh replay of the repository
migrations for tables, columns, constraints, indexes, RLS policies, and triggers. Two function
definitions differed. The legacy three-argument page move had equivalent SQL with different
formatting. The signup fallback still used the old product name and was updated to match the repo.
The missing rebrand migration `20260725120000` was applied and recorded with its SQL. The live
concept and delivery functions were verified, and GraphQL returned all ten published homepage blocks.

The database has 18 history rows for 19 repository files. The hosted versions of several early
migrations differ from their filenames. The hosted history has separate page-move permission and
redirect-index entries, and no standalone entries for the initial scaffold, template origin, or
template setup even though their schema effects are present. The delivery SQL matches the repo under
the hosted version documented above. Keep using targeted migrations until the ledger has been aligned
with the repository and a dry run confirms that only intended migrations would run.

## Applying the access control migration to the hosted project

This is a human step. Do not use `supabase db push` (the ledger is out of line, see above).

1. Check the hosted PostgreSQL major version is 15 or later (`select version();`). The migration uses
   `on delete set null (column)` and recursive `cycle` clauses.
2. Run the read-only pre-flight queries from the `do $preflight$` block at the top of the migration
   (owner consistency, slug format, revision ownership). Fix any offending rows by hand first; the
   migration raises and changes nothing if one exists.
3. Deploy the application build from this branch in the same window. The new Site Settings token
   flow calls `create_site_api_token` and `revoke_site_api_token`; an old build would fail to create
   or revoke tokens after the migration, and a new build fails before it.
4. Apply `supabase/migrations/20261127120000_access_control.sql` and then
   `20261127130000_navigation_publish_permission.sql` through the same isolated route used
   for earlier migrations (Management API, project-scoped MCP or an isolated CLI migration view), in
   one transaction, and record the remotely assigned version here.
5. Smoke test: sign in as owner, edit and publish a page, publish a header menu, move a page with redirects, create and
   revoke an API token, and fetch a delivery URL with a new token.

## Immediate next step

Apply the WP1 access control migrations to the hosted project (steps above). Invitation acceptance is
on the to-do list (direction in [Permissions](docs/specs/permissions.md)). Then continue with WP2
from `docs/reviews/2026-11-27-code-review-handover.md`. The hosted development project has the
concept/published revision model and the CMS-driven marketing homepage migration applied. A normal blanket migration push remains unsafe while older recorded
versions differ from local filenames. Next, design the separate autosave working-copy store and
confidential preview-token delivery mode before adding draft reads to REST or GraphQL, then add
arbitrary revision-history browsing and restoration.
