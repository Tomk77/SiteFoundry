# Contributing to Scaffold CMS

## Before changing code

Read `SPEC_INDEX.md`, `PROJECT_HANDOFF.md`, the relevant feature specification, and the architecture
decisions. Inspect `git status` so that unrelated work is not overwritten.

## Frontend structure

Administration code is organized by feature:

```text
src/
  routes/                 TanStack route declarations and URL adapters
  features/<feature>/     screens, feature components, hooks, and UI-only models
  components/ui/          reusable, feature-neutral UI primitives
  domain/                 framework-neutral CMS rules and models
  lib/                    current data access and shared application utilities
```

Route files should validate URL input, read typed route state, and render a feature screen. Keep new
route files at or below 150 non-empty lines and feature React files at or below 350 non-empty lines. Existing exceptions
are recorded in `tests/source-architecture.test.ts`; an exception may shrink, but it may not grow.
Remove its entry when the file is refactored.

Keep dependencies flowing inward:

- routes may import feature screens and shared code, but never Supabase directly;
- `domain/` must not import React, TanStack, Supabase, or administration features;
- `components/ui/` must not import feature code;
- one feature must not reach into another feature's internal files;
- feature-neutral behavior belongs in shared UI or application code, not in an arbitrary feature;
- do not turn duplicated proof-of-concept block metadata into a domain abstraction until the schema
  and field system specification resolves that model.

Prefer a small screen coordinator plus focused components and hooks. Keep data loading and mutations
out of presentational components. Put pure transformations in plain TypeScript modules so they can be
tested without rendering React.

## Tests

Tests live under `tests/` and mirror `src/`. Use the `@/` alias for source imports. Add focused tests
for extracted pure logic and retain route-level coverage for URL and integration behavior.

Before committing, run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm generate-routes
pnpm build
```

For visible changes, compare representative screens at the same viewport and theme before and after.
