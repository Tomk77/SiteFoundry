# ADR 0005: Test the database with PGlite replaying the repository migrations

- Status: Accepted
- Date: 2026-11-27

## Context

Row level security, SECURITY DEFINER functions and triggers carry most of the CMS authorization and
integrity rules, but no test executed them: `tests/migrations/` only searched the SQL text (review
finding 4.6). Fixing the access-control findings in WP1 needs tests that run the real SQL as
different users.

The usual route is pgTAP through `supabase test db`, which needs the Supabase CLI and a running Docker
daemon. Neither is guaranteed on developer machines or in CI today. The migration chain also cannot
replay on an empty database: `20260728152000_publish_marketing_homepage_blocks.sql` rewrites the
homepage of the site with slug `site-b562e3a7fd91` and raises when it is missing (finding 4.1).
Existing migrations must not be edited.

## Decision

Run database tests in Vitest against PGlite (`@electric-sql/pglite`, pinned to `0.3.16`, PostgreSQL
17.5 compiled to WebAssembly, in-process, no Docker).

- `tests/database/supabase-bootstrap.sql` recreates the small part of a Supabase project the
  migrations use: the `anon`, `authenticated` and `service_role` roles, `auth.users`, `auth.uid()`
  reading the `request.jwt.claim.sub` setting, pgcrypto in the `extensions` schema, and Supabase's
  default grants on `public` to the API roles (which is why RLS matters).
- `tests/database/harness.ts` applies the bootstrap and then every file in `supabase/migrations` in
  filename order. Right after the first migration it signs up a fixture account whose id starts with
  `b562e3a7-fd91`. The signup trigger derives the site slug from the user id, so this recreates the
  site `site-b562e3a7fd91` exactly as the hosted project got it, and the marketing migration then
  applies unchanged. The migrated database is dumped once per test file and each test loads a fresh
  copy.
- Tests act as a user by running inside a transaction with `set local role authenticated` (or
  `anon`) and the JWT subject setting, so policies, column grants and `auth.uid()` behave as they do
  behind PostgREST.
- Database tests run as part of `pnpm test`; `pnpm test:db` runs only them.

## Consequences

- RLS, grants, functions, triggers and constraints are executed on every test run, in about five
  seconds, without Docker.
- The bootstrap is a stand-in, not Supabase itself. Differences: no PostgREST layer, no real GoTrue
  `auth` schema, a single-process server (no concurrency tests, `pg_locks` reports no pid), and
  `statement_timeout` is ignored, so a test that triggers an unguarded infinite recursive query hangs
  instead of failing. Tests that could loop first assert that the guard exists.
- PGlite's PostgreSQL major version must stay close to the hosted project. Version-specific syntax
  that works locally must still be checked against the hosted version before applying a migration.
- The fixture account is test-only. It does not fix finding 4.1 for a real fresh database; that still
  needs the baseline and seed proposal from WP4.

## Revisit when

- The Supabase CLI and Docker become part of the standard toolchain or CI; then consider pgTAP through
  `supabase test db` against the real Supabase images.
- WP4 replaces the migration chain with a baseline schema and `supabase/seed.sql`; drop the fixture
  account then.
