alter table public.sites
  add column if not exists timezone text not null default 'Europe/Amsterdam',
  add column if not exists icon_url text,
  add column if not exists preview_url text not null default '';

alter table public.site_languages
  add column if not exists url_prefix text not null default '';

alter table public.site_members
  drop constraint if exists site_members_role_check;

alter table public.site_members
  add constraint site_members_role_check
  check (role in ('owner', 'admin', 'publisher', 'editor', 'viewer'));

alter table public.site_members
  add column if not exists access_scope text not null default 'full'
    check (access_scope in ('full', 'languages', 'branches')),
  add column if not exists language_ids uuid[] not null default '{}',
  add column if not exists branch_ids uuid[] not null default '{}',
  add column if not exists sections text[] not null default array['pages', 'media'],
  add column if not exists updated_at timestamptz not null default now();

alter table public.site_members
  drop constraint if exists site_members_sections_check;

alter table public.site_members
  add constraint site_members_sections_check check (
    sections <@ array[
      'pages', 'media', 'redirects', 'navigation', 'footer', 'structured', 'templates'
    ]::text[]
  );

drop trigger if exists site_members_set_updated_at on public.site_members;
create trigger site_members_set_updated_at
before update on public.site_members
for each row execute function public.set_updated_at();

create table if not exists public.site_invitations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'publisher', 'editor', 'viewer')),
  access_scope text not null default 'full' check (access_scope in ('full', 'languages', 'branches')),
  language_ids uuid[] not null default '{}',
  branch_ids uuid[] not null default '{}',
  sections text[] not null default array['pages', 'media'],
  status text not null default 'pending' check (status in ('pending', 'revoked', 'accepted', 'expired')),
  invited_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_invitations_sections_check check (
    sections <@ array[
      'pages', 'media', 'redirects', 'navigation', 'footer', 'structured', 'templates'
    ]::text[]
  )
);

create unique index if not exists site_invitations_pending_email_idx
on public.site_invitations (site_id, lower(email))
where status = 'pending';

create index if not exists site_invitations_site_id_idx
on public.site_invitations (site_id, created_at desc);

drop trigger if exists site_invitations_set_updated_at on public.site_invitations;
create trigger site_invitations_set_updated_at
before update on public.site_invitations
for each row execute function public.set_updated_at();

create table if not exists public.site_domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  hostname text not null,
  is_primary boolean not null default false,
  status text not null default 'verification_pending'
    check (status in ('verified', 'verification_pending', 'misconfigured', 'not_connected')),
  verification_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, hostname)
);

create unique index if not exists site_domains_one_primary_idx
on public.site_domains (site_id)
where is_primary;

create unique index if not exists site_domains_hostname_case_insensitive_idx
on public.site_domains (site_id, lower(hostname));

drop trigger if exists site_domains_set_updated_at on public.site_domains;
create trigger site_domains_set_updated_at
before update on public.site_domains
for each row execute function public.set_updated_at();

create table if not exists public.site_export_requests (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  status text not null default 'queued' check (status in ('queued', 'preparing', 'ready', 'failed')),
  download_path text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists site_export_requests_site_id_idx
on public.site_export_requests (site_id, created_at desc);

create or replace function private.can_manage_site_settings(
  target_site_id uuid,
  target_user_id uuid
)
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
      and site_members.role in ('owner', 'admin')
  );
$$;

create or replace function private.shares_site(target_user_id uuid, viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.site_members target
    join public.site_members viewer on viewer.site_id = target.site_id
    where target.user_id = target_user_id
      and viewer.user_id = viewer_id
      and viewer.role in ('owner', 'admin')
  );
$$;

revoke all on function private.can_manage_site_settings(uuid, uuid) from public, anon;
revoke all on function private.shares_site(uuid, uuid) from public, anon;
grant execute on function private.can_manage_site_settings(uuid, uuid) to authenticated;
grant execute on function private.shares_site(uuid, uuid) to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can read permitted profiles" on public.profiles;
create policy "Users can read permitted profiles"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or private.shares_site(id, (select auth.uid()))
);

drop policy if exists "Owners can update sites" on public.sites;
create policy "Settings managers can update sites"
on public.sites for update to authenticated
using (private.can_manage_site_settings(id, (select auth.uid())))
with check (private.can_manage_site_settings(id, (select auth.uid())));

drop policy if exists "Owners can add memberships" on public.site_members;
create policy "Settings managers can add memberships"
on public.site_members for insert to authenticated
with check (
  private.can_manage_site_settings(site_id, (select auth.uid()))
  and role <> 'owner'
);

drop policy if exists "Owners can update memberships" on public.site_members;
create policy "Settings managers can update memberships"
on public.site_members for update to authenticated
using (
  private.can_manage_site_settings(site_id, (select auth.uid()))
  and role <> 'owner'
)
with check (
  private.can_manage_site_settings(site_id, (select auth.uid()))
  and role <> 'owner'
);

drop policy if exists "Owners can remove memberships" on public.site_members;
create policy "Settings managers can remove memberships"
on public.site_members for delete to authenticated
using (
  private.can_manage_site_settings(site_id, (select auth.uid()))
  and role <> 'owner'
  and user_id <> (select auth.uid())
);

drop policy if exists "Editors can create site languages" on public.site_languages;
drop policy if exists "Settings managers can create site languages" on public.site_languages;
create policy "Settings managers can create site languages"
on public.site_languages for insert to authenticated
with check (private.can_manage_site_settings(site_id, (select auth.uid())));

drop policy if exists "Editors can update site languages" on public.site_languages;
drop policy if exists "Settings managers can update site languages" on public.site_languages;
create policy "Settings managers can update site languages"
on public.site_languages for update to authenticated
using (private.can_manage_site_settings(site_id, (select auth.uid())))
with check (private.can_manage_site_settings(site_id, (select auth.uid())));

drop policy if exists "Settings managers can delete site languages" on public.site_languages;
create policy "Settings managers can delete site languages"
on public.site_languages for delete to authenticated
using (
  private.can_manage_site_settings(site_id, (select auth.uid()))
  and not is_default
  and not exists (
    select 1 from public.pages where pages.site_language_id = site_languages.id
  )
);

alter table public.site_invitations enable row level security;
alter table public.site_domains enable row level security;
alter table public.site_export_requests enable row level security;

create policy "Settings managers can read invitations"
on public.site_invitations for select to authenticated
using (private.can_manage_site_settings(site_id, (select auth.uid())));

create policy "Settings managers can create invitations"
on public.site_invitations for insert to authenticated
with check (
  private.can_manage_site_settings(site_id, (select auth.uid()))
  and invited_by = (select auth.uid())
);

create policy "Settings managers can update invitations"
on public.site_invitations for update to authenticated
using (private.can_manage_site_settings(site_id, (select auth.uid())))
with check (private.can_manage_site_settings(site_id, (select auth.uid())));

create policy "Members can read domains"
on public.site_domains for select to authenticated
using (private.is_site_member(site_id, (select auth.uid())));

create policy "Settings managers can create domains"
on public.site_domains for insert to authenticated
with check (private.can_manage_site_settings(site_id, (select auth.uid())));

create policy "Settings managers can update domains"
on public.site_domains for update to authenticated
using (private.can_manage_site_settings(site_id, (select auth.uid())))
with check (private.can_manage_site_settings(site_id, (select auth.uid())));

create policy "Settings managers can delete domains"
on public.site_domains for delete to authenticated
using (private.can_manage_site_settings(site_id, (select auth.uid())));

create policy "Settings managers can read their export requests"
on public.site_export_requests for select to authenticated
using (
  private.can_manage_site_settings(site_id, (select auth.uid()))
  and requested_by = (select auth.uid())
);

create policy "Settings managers can request exports"
on public.site_export_requests for insert to authenticated
with check (
  private.can_manage_site_settings(site_id, (select auth.uid()))
  and requested_by = (select auth.uid())
);

create or replace function public.set_default_site_language(
  target_site_id uuid,
  target_language_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_site_settings(target_site_id, auth.uid()) then
    raise exception 'You cannot manage languages for this site.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.site_languages
    where id = target_language_id and site_id = target_site_id
  ) then
    raise exception 'Language does not belong to this site.' using errcode = '23503';
  end if;

  update public.site_languages
  set is_default = false
  where site_id = target_site_id and is_default;

  update public.site_languages
  set is_default = true
  where id = target_language_id;
end;
$$;

create or replace function public.update_site_member_access(
  target_site_id uuid,
  target_user_id uuid,
  target_role text,
  target_access_scope text,
  target_language_ids uuid[],
  target_branch_ids uuid[],
  target_sections text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_site_settings(target_site_id, auth.uid()) then
    raise exception 'You cannot manage people for this site.' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.site_members
    where site_id = target_site_id and user_id = target_user_id and role = 'owner'
  ) then
    raise exception 'Ownership must be changed through the ownership transfer flow.' using errcode = '42501';
  end if;

  if target_role not in ('admin', 'publisher', 'editor', 'viewer') then
    raise exception 'Invalid role.' using errcode = '22023';
  end if;

  if target_access_scope not in ('full', 'languages', 'branches') then
    raise exception 'Invalid access scope.' using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(coalesce(target_language_ids, '{}')) language_id
    where not exists (
      select 1 from public.site_languages
      where id = language_id and site_id = target_site_id
    )
  ) then
    raise exception 'A selected language does not belong to this site.' using errcode = '23503';
  end if;

  if exists (
    select 1 from unnest(coalesce(target_branch_ids, '{}')) branch_id
    where not exists (
      select 1
      from public.pages page
      join public.site_languages language on language.id = page.site_language_id
      where page.id = branch_id and language.site_id = target_site_id
    )
  ) then
    raise exception 'A selected page branch does not belong to this site.' using errcode = '23503';
  end if;

  update public.site_members
  set role = target_role,
      access_scope = target_access_scope,
      language_ids = coalesce(target_language_ids, '{}'),
      branch_ids = coalesce(target_branch_ids, '{}'),
      sections = coalesce(target_sections, '{}')
  where site_id = target_site_id and user_id = target_user_id;

  if not found then
    raise exception 'Site membership was not found.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.set_primary_site_domain(
  target_site_id uuid,
  target_domain_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_site_settings(target_site_id, auth.uid()) then
    raise exception 'You cannot manage domains for this site.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.site_domains
    where id = target_domain_id and site_id = target_site_id
  ) then
    raise exception 'Domain does not belong to this site.' using errcode = '23503';
  end if;

  update public.site_domains
  set is_primary = false
  where site_id = target_site_id and is_primary;

  update public.site_domains
  set is_primary = true
  where id = target_domain_id;
end;
$$;

create or replace function public.transfer_site_ownership(
  target_site_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_owner_id uuid;
begin
  select owner_id into current_owner_id
  from public.sites
  where id = target_site_id
  for update;

  if current_owner_id is distinct from auth.uid() then
    raise exception 'Only the current owner can transfer ownership.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.site_members
    where site_id = target_site_id and user_id = target_user_id and role = 'admin'
  ) then
    raise exception 'Ownership can only be transferred to an Administrator.' using errcode = '22023';
  end if;

  update public.site_members
  set role = case
    when user_id = current_owner_id then 'admin'
    when user_id = target_user_id then 'owner'
    else role
  end
  where site_id = target_site_id
    and user_id in (current_owner_id, target_user_id);

  update public.sites set owner_id = target_user_id where id = target_site_id;
end;
$$;

create or replace function public.get_site_settings_workspace(target_site_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  selected_site_id uuid;
  viewer_role text;
  can_manage boolean;
  result jsonb;
begin
  select site.id, member.role
  into selected_site_id, viewer_role
  from public.sites site
  join public.site_members member on member.site_id = site.id
  where member.user_id = viewer_id
    and (target_site_id is null or site.id = target_site_id)
  order by site.created_at
  limit 1;

  if selected_site_id is null then return null; end if;
  can_manage := viewer_role in ('owner', 'admin');

  select jsonb_build_object(
    'viewerRole', viewer_role,
    'site', jsonb_build_object(
      'id', site.id,
      'name', site.name,
      'slug', site.slug,
      'ownerId', site.owner_id,
      'timezone', site.timezone,
      'iconUrl', site.icon_url,
      'previewUrl', site.preview_url
    ),
    'languages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', language.id,
        'code', language.code,
        'name', language.name,
        'isDefault', language.is_default,
        'position', language.position,
        'urlPrefix', language.url_prefix,
        'pageCount', (select count(*) from public.pages where site_language_id = language.id)
      ) order by language.position)
      from public.site_languages language
      where language.site_id = site.id
    ), '[]'::jsonb),
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', page.id,
        'name', page.title,
        'languageId', language.id,
        'languageName', language.name
      ) order by language.position, page.position)
      from public.pages page
      join public.site_languages language on language.id = page.site_language_id
      where language.site_id = site.id and page.parent_id is null
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', member.user_id,
        'name', coalesce(profile.display_name, profile.full_name, split_part(account.email, '@', 1), 'Member'),
        'email', account.email,
        'role', member.role,
        'accessScope', member.access_scope,
        'languageIds', member.language_ids,
        'branchIds', member.branch_ids,
        'sections', member.sections,
        'lastActiveAt', account.last_sign_in_at,
        'current', member.user_id = viewer_id
      ) order by case member.role when 'owner' then 0 when 'admin' then 1 else 2 end, member.created_at)
      from public.site_members member
      join auth.users account on account.id = member.user_id
      left join public.profiles profile on profile.id = member.user_id
      where member.site_id = site.id and (can_manage or member.user_id = viewer_id)
    ), '[]'::jsonb),
    'invitations', case when can_manage then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', invitation.id,
        'email', invitation.email,
        'role', invitation.role,
        'accessScope', invitation.access_scope,
        'languageIds', invitation.language_ids,
        'branchIds', invitation.branch_ids,
        'sections', invitation.sections,
        'status', case
          when invitation.status = 'pending' and invitation.expires_at <= now() then 'expired'
          else invitation.status
        end,
        'invitedBy', coalesce(inviter.display_name, inviter.full_name, 'Site administrator'),
        'createdAt', invitation.created_at,
        'expiresAt', invitation.expires_at
      ) order by invitation.created_at desc)
      from public.site_invitations invitation
      left join public.profiles inviter on inviter.id = invitation.invited_by
      where invitation.site_id = site.id and invitation.status = 'pending'
    ), '[]'::jsonb) else '[]'::jsonb end,
    'domains', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', domain.id,
        'hostname', domain.hostname,
        'isPrimary', domain.is_primary,
        'status', domain.status,
        'verificationMessage', domain.verification_message
      ) order by domain.is_primary desc, domain.created_at)
      from public.site_domains domain where domain.site_id = site.id
    ), '[]'::jsonb)
  ) into result
  from public.sites site where site.id = selected_site_id;

  return result;
end;
$$;

revoke all on function public.set_default_site_language(uuid, uuid) from public, anon;
revoke all on function public.update_site_member_access(uuid, uuid, text, text, uuid[], uuid[], text[]) from public, anon;
revoke all on function public.set_primary_site_domain(uuid, uuid) from public, anon;
revoke all on function public.transfer_site_ownership(uuid, uuid) from public, anon;
revoke all on function public.get_site_settings_workspace(uuid) from public, anon;
grant execute on function public.set_default_site_language(uuid, uuid) to authenticated;
grant execute on function public.update_site_member_access(uuid, uuid, text, text, uuid[], uuid[], text[]) to authenticated;
grant execute on function public.set_primary_site_domain(uuid, uuid) to authenticated;
grant execute on function public.transfer_site_ownership(uuid, uuid) to authenticated;
grant execute on function public.get_site_settings_workspace(uuid) to authenticated;

update public.site_members member
set language_ids = coalesce((
  select array_agg(language.id order by language.position)
  from public.site_languages language where language.site_id = member.site_id
), '{}')
where member.access_scope = 'full' and cardinality(member.language_ids) = 0;
