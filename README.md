# Scaffold CMS

An early planning and implementation workspace for Scaffold CMS, an open-source, website-native headless CMS.

The project currently contains a minimal TanStack Start application and the first product and architecture documents. It intentionally does not include a database, authentication, or CMS domain implementation yet; those choices should follow the product definition.

## Local development

Requirements:

- Node.js 22.12 or newer (Volta uses 22.19 for this project)
- pnpm 9.1 or newer

```bash
pnpm install
pnpm dev
```

The app runs at [http://localhost:4000](http://localhost:4000) against the Supabase project in
`.env.local`. To work against a disposable local database instead (Docker required):

```bash
pnpm db:start
pnpm db:reset
pnpm dev:local
```

[docs/SETUP.md](docs/SETUP.md) covers setup, environment variables, test data and testing.

## Checks

```bash
pnpm generate-routes
pnpm typecheck
pnpm test
pnpm build
```

Tests live in the top-level `tests/` directory and mirror the structure under `src/`. Test
imports use the `@/` source alias so moving a test does not create brittle relative paths.

## Documentation

- [Specification index and roadmap](SPEC_INDEX.md)
- [Project handoff](PROJECT_HANDOFF.md)
- [Page tree specification](PAGE_TREE_SPEC.md)
- [Product vision](docs/product/vision.md)
- [MVP scope](docs/product/mvp.md)
- [Competitor research](docs/product/competitors.md)
- [Architecture overview](docs/architecture/overview.md)
- [Architecture decisions](docs/decisions/README.md)

## Current stack

- TanStack Start and Router
- React and TypeScript
- Vite
- Tailwind CSS
- Vitest

TanStack packages are pinned while TanStack Start is at the release-candidate stage. Dependency updates should be intentional and followed by all checks above.
