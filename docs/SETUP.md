# Setup

How to get from a fresh clone to a running Scaffold CMS, with a local database you can break freely.

## 1. Requirements

- Node 22.19 and pnpm 9.1.4 (Volta pins both, see `package.json`).
- Docker Desktop, running, for the local Supabase stack.
- Nothing else: the Supabase CLI is a pinned dev dependency (`pnpm exec supabase`).

## 2. Install and run against a local database

```bash
pnpm install
pnpm db:start
pnpm db:reset
pnpm dev:local
```

- `pnpm db:start` starts Postgres 17, Auth (GoTrue), PostgREST, Studio and a mail catcher in Docker.
  Config: `supabase/config.jsonc`. Studio: http://127.0.0.1:54323. Mail: http://127.0.0.1:54324.
- `pnpm db:reset` wipes the local database and runs `scripts/local-db-reset.mjs`. That script
  replays every file in `supabase/migrations` in order and creates the local development account
  right after the first migration. The account owns site `site-b562e3a7fd91`, which the marketing
  homepage migration needs (review finding 4.1). The script refuses non-local API URLs.
- `pnpm dev:local` runs the app on http://localhost:4000 in Vite mode `localdb`, which reads the
  git-ignored `.env.localdb.local` written by the reset script.
- Sign in with the local account. Its email and password are the defaults at the top of
  `scripts/local-db-reset.mjs` (override with `LOCAL_DEV_EMAIL` and `LOCAL_DEV_PASSWORD`).
- `pnpm db:stop` stops the containers.

The CLI applies neither migrations nor seeds itself (`db.migrations.enabled` and `db.seed.enabled`
are false); always reset through `pnpm db:reset`.

## 3. Environment variables

| Variable                        | Used by                     | Where the value comes from                                  |
| ------------------------------- | --------------------------- | ----------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | browser and delivery routes | Local: written by `pnpm db:reset`. Hosted: Supabase project settings, API. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser and delivery routes | Local: written by `pnpm db:reset`. Hosted: Supabase project settings, API keys. |

`.env.example` lists them. Hosted values go in a git-ignored `.env.local` and are used by `pnpm dev`.
Never commit real values. No service-role key is used by the application.

## 4. Test data

- Local: `pnpm db:reset` gives you the demo page tree, structured content, templates and the
  marketing homepage, all created by the migrations. There is no separate seed file yet (WP4).
- Automated tests never touch a running database. `tests/database/` replays the migrations into an
  in-process PGlite database per test file (ADR 0005).
- Never copy hosted data or backups into the repository.

## 5. External dependencies

- **Supabase** (Postgres, Auth, PostgREST): the browser talks to it directly with RLS. The hosted
  project's migration ledger does not match the repository; see `PROJECT_HANDOFF.md` before applying
  anything there, and never run `supabase db push`.
- **Apollo Sandbox** (embedded in Site Settings, API access) for exploring GraphQL.
- The standalone marketing website is a separate repository that reads the delivery API.

## 6. Testing a bug or feature

```bash
pnpm test        # unit, route and database tests
pnpm test:db     # database tests only
pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
```

To check behaviour by hand, run `pnpm db:reset` and `pnpm dev:local`, sign in with the local
account, and exercise the flow. Delivery API calls need a token from Site Settings, API access:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/v1/sites/site-b562e3a7fd91/pages
```
