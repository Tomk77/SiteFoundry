# Project handoff

- Last updated: 2026-07-10
- Project stage: Product discovery and technical foundation

## What this project is

SiteFoundry is an open-source, headless CMS focused on real website workflows. It aims to replace the disconnected collection-first mental model of many headless CMS products with a canonical page tree that ordinary website editors can understand.

The CMS will serve content through REST and GraphQL. Consuming websites remain responsible for rendering.

## Current state

- A minimal TanStack Start application is scaffolded and builds successfully.
- TanStack dependencies are pinned.
- The product vision and initial architecture are documented.
- Page-tree product discovery is complete enough for a working specification.
- No database, authentication, CMS domain model, or content API has been implemented.
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
- Schemas and templates are edited only in local development and saved as JSON files.
- Production schemas are deployed and read-only.

## Technical direction

- TanStack Start powers the initial administration application and early server layer.
- CMS domain logic must remain independent of React and TanStack.
- PostgreSQL is the intended first database.
- S3-compatible storage is the intended media-storage abstraction.
- Consuming websites must not be required to use React or TanStack.

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

## Immediate next step

Continue product discovery with the schema and field system or the page editor. Do not begin database implementation until the schema, page-content, and revision boundaries are better specified.
