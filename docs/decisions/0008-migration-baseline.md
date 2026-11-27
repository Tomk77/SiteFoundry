# ADR 0008: Replace the migration chain with a baseline and a seed

- Status: Proposed
- Date: 2026-11-27

## Context

Review findings 4.1 to 4.3:

- **4.1** The chain cannot replay on an empty database: `20260728152000` rewrites the homepage of
  site `site-b562e3a7fd91` and raises when it is missing. Local development and the database tests
  work around this by creating a fixture account right after the first migration
  (`scripts/local-db-reset.mjs`, `tests/database/harness.ts`).
- **4.2** Several migrations are data migrations over tenant content: every page with slug
  `product-launch` on every site is overwritten (`20260712183000`), the rebrand replaces text in all
  tenants' content and snapshots (`20260725120000`), and demo pages are inserted into existing sites
  (`20260712165500` and later). A fresh self-hosted install replays all of that.
- **4.3** Some statements are not idempotent (`add constraint` and `create policy` without guards).
- The hosted project's migration ledger does not match the repository filenames (see
  `PROJECT_HANDOFF.md`), so `supabase db push` is unsafe today.

Existing migration files must not be edited.

## Proposal

1. **Baseline.** Add one schema-only migration, for example `20261201000000_baseline.sql`, produced by
   `supabase db dump --local --schema public,private` after `pnpm db:reset`, then reviewed by hand. It
   contains tables, constraints, indexes, functions, triggers, policies and grants, and no data.
2. **Archive the history.** Move every earlier migration to `supabase/migrations-archive/` in the same
   change, unchanged, so the history stays readable. Fresh databases replay only the baseline and
   later migrations.
3. **Seed.** Move demo content (page tree, structured content, templates, marketing homepage) into
   `supabase/seed.sql`, applied by `pnpm db:reset` locally and never on the hosted project. The
   fixture account and its slug become part of the seed; the reset script no longer needs to insert
   it between migrations.
4. **Hosted ledger.** A human, with the hosted project in maintenance:
   - compares the hosted schema with the baseline (`supabase db diff` against a local reset, or a
     schema dump compared by hand) and resolves every difference first;
   - deletes the old rows from `supabase_migrations.schema_migrations` and inserts one row for the
     baseline version, so the ledger says "baseline applied";
   - from then on uses `supabase db push` with `--dry-run` first.
5. **Tests.** `tests/database/harness.ts` and `scripts/local-db-reset.mjs` replay the baseline and later
   migrations, then the seed. `tests/database/replay.test.ts` keeps asserting that the result matches
   what the application expects.
6. **Rules going forward.** Migrations are schema changes only, use `if not exists` / `drop ... if
exists` guards, and never touch tenant data. Data fixes for a specific tenant are one-off scripts
   run by a human, not migrations.

## Consequences

- Fresh installs and CI no longer depend on one tenant's data or replay rewrites of other tenants.
- The hosted ledger reconciliation is a one-off manual step with real risk; it needs a backup and a
  dry run.
- Until this lands, the fixture workaround in the reset script and the test harness stays.

## Not done yet

Nothing in this ADR is implemented. It needs an owner and a maintenance window for step 4, and the
WP1 to WP4 migrations from 2026-11-27 should be applied to the hosted project first, so the baseline
starts from a schema that already includes them.
