# Administration frontend structure

- Status: Accepted
- Last updated: 2026-07-21

## Purpose

The proof-of-concept administration UI grew around route files. This document defines the structure
used to make those screens easier to understand and to keep new code from recreating the same issue.
It refines the administration boundary in the architecture overview; it does not decide the unresolved
CMS schema, revision, or delivery models.

## Feature ownership

Each user-facing capability owns a directory under `src/features`. A feature may contain its screen,
focused components, hooks, and UI-only configuration. TanStack route files remain adapters responsible
for route declaration, search validation, and handing typed URL state to the feature.

Shared visual primitives live in `src/components/ui`. A component belongs there only when it is
feature-neutral and has a stable reusable contract. Framework-neutral CMS rules and models belong in
`src/domain`; React, TanStack, Tailwind, and Supabase must not enter that boundary.

The existing `src/lib` modules remain the proof-of-concept application and persistence layer. Moving
them into formal application and infrastructure packages is deferred until the related specifications
resolve repository interfaces, transaction boundaries, and the domain model.

## Dependency direction

```text
routes -> features -> shared UI
   |          |
   +----------+----> application/data modules -> Supabase
                         |
                         +----> framework-neutral domain
```

Features expose public entry points to routes. A feature may use shared UI and application/data
modules, but must not import another feature's internal files. Cross-feature behavior should be moved
to an intentional shared boundary instead.

## File shape

- New route files are at most 150 lines.
- React files are normally at most 350 lines.
- A screen coordinates state and behavior; presentational regions live in focused components.
- Pure configuration and transformations live in `.ts` modules.
- Existing oversized files use a checked-in no-growth baseline while being migrated.

These are design pressure, not a reason to split cohesive code into arbitrary fragments. Exceptions
require an explicit baseline and should be removed as soon as their feature is refactored.

## Enforcement

`tests/source-architecture.test.ts` checks file sizes and dependency boundaries. CI runs formatting,
linting, type checking, tests, route generation, and the production build. `CONTRIBUTING.md` documents
the workflow contributors should follow.

