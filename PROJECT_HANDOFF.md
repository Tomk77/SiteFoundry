# Project handoff

- Last updated: 2026-07-21
- Project stage: Functional proof of concept

## What this project is

SiteFoundry is an open-source, headless CMS focused on real website workflows. It aims to replace the disconnected collection-first mental model of many headless CMS products with a canonical page tree that ordinary website editors can understand.

The CMS will serve content through REST and GraphQL. Consuming websites remain responsible for rendering.

## Current state

- A TanStack Start administration application is implemented and builds successfully.
- Supabase authentication and database persistence support the proof of concept.
- Page tree, page editor, media flow, redirects, navigation, structured content, and personal settings have working UI flows.
- Page templates are implemented as language-scoped database definitions with production editing, draft/published lifecycle, revision history, validation, fallback selection, usage reporting, and copy-on-create page creation.
- Site Settings has a Supabase-backed Tailwind implementation covering General, People & access, Languages, Domains & preview, and Advanced. It includes URL-restorable navigation, real accounts and memberships, role presets, scoped access, responsive layouts, persisted invitations, guarded ownership transfer and deletion, domain verification requests, and queued exports. RLS limits settings mutations to owners and administrators and limits other roles to a conservative view of their own access. Invitation delivery/acceptance, DNS verification, export generation, and the final formal permission contract remain unresolved.
- Administration source is feature-first. Every TanStack route is a thin typed adapter importing a feature through its public `index.ts`; the Page Editor is split into focused coordinator, model, preview, toolbar, panel, tab, and overlay modules, while navigation separates tree operations, cards, and previews. Remaining oversized proof-of-concept coordinators have explicit no-growth baselines.
- Tailwind CSS 4 is the administration styling system across the complete UI: authentication, loading states, app shell, Page Tree, Page Editor, Media, Redirects, Header Navigation, Footer, Structured Content, Page Templates, Personal Settings, Site Settings, shared dialogs, controls, and toasts. Route-owned stylesheets have been removed; `src/styles.css` now contains only the runtime theme, global element foundations, Tailwind theme registration, and shared keyframes imported from `src/animations.css`.
- The product vision and initial architecture are documented.
- Page-tree product discovery is complete enough for a working specification.
- A public REST or GraphQL content API has not yet been implemented.
- No production deployment target has been selected.

## Start here on a new machine

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
- GitHub Actions runs formatting, linting, type checking, tests, route generation, and the production build for pushes to `main` and pull requests.
- The linked hosted Supabase project contains legacy migration-history versions that do not match several local migration filenames. Site Settings migration `20260721213000` was applied directly through the linked Management API and marked applied on 2026-07-21. Before using a future blanket `supabase db push`, reconcile the older history through schema comparison; do not blindly replay or repair those entries.

## Immediate next step

Specify and harden the shared schema and field system, then use it to remove the remaining duplicated component metadata between page editing, structured content, and page templates. After that, define the revision and public content API contracts before treating the proof of concept as production architecture.
