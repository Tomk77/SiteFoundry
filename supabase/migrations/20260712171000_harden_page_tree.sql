create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create or replace function private.is_site_member(target_site_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.site_members
    where site_members.site_id = target_site_id
      and site_members.user_id = target_user_id
  );
$$;

create or replace function private.can_edit_site(target_site_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.site_members
    where site_members.site_id = target_site_id
      and site_members.user_id = target_user_id
      and site_members.role in ('owner', 'admin', 'editor')
  );
$$;

create or replace function private.is_language_member(target_language_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.site_languages language
    join public.site_members member on member.site_id = language.site_id
    where language.id = target_language_id
      and member.user_id = target_user_id
  );
$$;

create or replace function private.can_edit_language(target_language_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.site_languages language
    join public.site_members member on member.site_id = language.site_id
    where language.id = target_language_id
      and member.user_id = target_user_id
      and member.role in ('owner', 'admin', 'editor')
  );
$$;

revoke all on function private.is_site_member(uuid, uuid) from public, anon;
revoke all on function private.can_edit_site(uuid, uuid) from public, anon;
revoke all on function private.is_language_member(uuid, uuid) from public, anon;
revoke all on function private.can_edit_language(uuid, uuid) from public, anon;
grant execute on function private.is_site_member(uuid, uuid) to authenticated;
grant execute on function private.can_edit_site(uuid, uuid) to authenticated;
grant execute on function private.is_language_member(uuid, uuid) to authenticated;
grant execute on function private.can_edit_language(uuid, uuid) to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "Members can read their sites" on public.sites;
create policy "Members can read their sites"
on public.sites for select to authenticated
using (private.is_site_member(id, (select auth.uid())));

drop policy if exists "Owners can create sites" on public.sites;
create policy "Owners can create sites"
on public.sites for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can update sites" on public.sites;
create policy "Owners can update sites"
on public.sites for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can delete sites" on public.sites;
create policy "Owners can delete sites"
on public.sites for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "Members can read memberships" on public.site_members;
create policy "Members can read memberships"
on public.site_members for select to authenticated
using (private.is_site_member(site_id, (select auth.uid())));

drop policy if exists "Owners can add memberships" on public.site_members;
create policy "Owners can add memberships"
on public.site_members for insert to authenticated
with check (
  exists (
    select 1 from public.sites
    where sites.id = site_members.site_id
      and sites.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can update memberships" on public.site_members;
create policy "Owners can update memberships"
on public.site_members for update to authenticated
using (
  exists (
    select 1 from public.sites
    where sites.id = site_members.site_id
      and sites.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.sites
    where sites.id = site_members.site_id
      and sites.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can remove memberships" on public.site_members;
create policy "Owners can remove memberships"
on public.site_members for delete to authenticated
using (
  exists (
    select 1 from public.sites
    where sites.id = site_members.site_id
      and sites.owner_id = (select auth.uid())
  )
);

drop policy if exists "Members can read site languages" on public.site_languages;
create policy "Members can read site languages"
on public.site_languages for select to authenticated
using (private.is_site_member(site_id, (select auth.uid())));

drop policy if exists "Editors can create site languages" on public.site_languages;
create policy "Editors can create site languages"
on public.site_languages for insert to authenticated
with check (private.can_edit_site(site_id, (select auth.uid())));

drop policy if exists "Editors can update site languages" on public.site_languages;
create policy "Editors can update site languages"
on public.site_languages for update to authenticated
using (private.can_edit_site(site_id, (select auth.uid())))
with check (private.can_edit_site(site_id, (select auth.uid())));

drop policy if exists "Members can read pages" on public.pages;
create policy "Members can read pages"
on public.pages for select to authenticated
using (private.is_language_member(site_language_id, (select auth.uid())));

drop policy if exists "Editors can create pages" on public.pages;
create policy "Editors can create pages"
on public.pages for insert to authenticated
with check (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Editors can update pages" on public.pages;
create policy "Editors can update pages"
on public.pages for update to authenticated
using (private.can_edit_language(site_language_id, (select auth.uid())))
with check (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Editors can delete pages" on public.pages;
create policy "Editors can delete pages"
on public.pages for delete to authenticated
using (private.can_edit_language(site_language_id, (select auth.uid())));

drop function if exists public.can_edit_language(uuid, uuid);
drop function if exists public.is_language_member(uuid, uuid);
drop function if exists public.is_site_member(uuid, uuid);

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.initialize_site_page_tree() from public, anon, authenticated;

create index if not exists pages_parent_id_idx on public.pages(parent_id);
create index if not exists site_members_user_id_idx on public.site_members(user_id);
create index if not exists sites_owner_id_idx on public.sites(owner_id);
