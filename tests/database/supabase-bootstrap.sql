-- Minimal local stand-in for the parts of a Supabase project that the repository migrations use.
-- It is loaded into a throwaway PGlite database before the migrations replay. It never runs against
-- a hosted project. See docs/decisions/0005-local-database-tests.md.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

-- Supabase installs pgcrypto in the extensions schema before any project migration runs, so the
-- repository's `create extension if not exists pgcrypto` is a no-op there. Mirror that here.
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension pgcrypto with schema extensions;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);

-- Same contract as Supabase: the subject claim of the request JWT, or null.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase grants table, sequence and function privileges in public to the API roles and relies on
-- RLS. Reproduce that so tests see the same privilege surface as PostgREST.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
