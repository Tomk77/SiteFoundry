create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_members (
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (site_id, user_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists sites_set_updated_at on public.sites;
create trigger sites_set_updated_at
before update on public.sites
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_site_id uuid;
  display_name text;
begin
  display_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1), 'Scaffold CMS user');

  insert into public.profiles (id, full_name)
  values (new.id, display_name)
  on conflict (id) do update set full_name = excluded.full_name;

  insert into public.sites (name, slug, owner_id)
  values ('My first site', 'site-' || left(replace(new.id::text, '-', ''), 12), new.id)
  returning id into new_site_id;

  insert into public.site_members (site_id, user_id, role)
  values (new_site_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_site_member(target_site_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_members
    where site_members.site_id = target_site_id
      and site_members.user_id = target_user_id
  );
$$;

revoke execute on function public.is_site_member(uuid, uuid) from public;
grant execute on function public.is_site_member(uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.site_members enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Members can read their sites" on public.sites;
create policy "Members can read their sites"
on public.sites for select
to authenticated
using (
  public.is_site_member(sites.id, auth.uid())
);

drop policy if exists "Owners can create sites" on public.sites;
create policy "Owners can create sites"
on public.sites for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Owners can update sites" on public.sites;
create policy "Owners can update sites"
on public.sites for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Owners can delete sites" on public.sites;
create policy "Owners can delete sites"
on public.sites for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists "Members can read memberships" on public.site_members;
create policy "Members can read memberships"
on public.site_members for select
to authenticated
using (
  public.is_site_member(site_members.site_id, auth.uid())
);

drop policy if exists "Owners can add memberships" on public.site_members;
create policy "Owners can add memberships"
on public.site_members for insert
to authenticated
with check (
  exists (
    select 1 from public.sites
    where sites.id = site_members.site_id
      and sites.owner_id = auth.uid()
  )
);

drop policy if exists "Owners can update memberships" on public.site_members;
create policy "Owners can update memberships"
on public.site_members for update
to authenticated
using (
  exists (
    select 1 from public.sites
    where sites.id = site_members.site_id
      and sites.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.sites
    where sites.id = site_members.site_id
      and sites.owner_id = auth.uid()
  )
);

drop policy if exists "Owners can remove memberships" on public.site_members;
create policy "Owners can remove memberships"
on public.site_members for delete
to authenticated
using (
  exists (
    select 1 from public.sites
    where sites.id = site_members.site_id
      and sites.owner_id = auth.uid()
  )
);
