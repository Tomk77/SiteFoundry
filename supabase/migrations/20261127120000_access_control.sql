-- WP1 access control. Closes findings 1.1 to 1.10 of
-- docs/reviews/2026-11-27-code-review-handover.md. Every change is covered by tests/database.
--
-- Requires PostgreSQL 15 or later (ON DELETE SET NULL with a column list).
-- The data checks at the top raise before anything changes when existing rows would violate the
-- new rules. See PROJECT_HANDOFF.md for how to apply this to the hosted project.

-------------------------------------------------------------------------------------------------
-- Pre-flight data checks
-------------------------------------------------------------------------------------------------

do $preflight$
begin
  if exists (
    select 1
    from public.sites site
    where (
      select count(*) from public.site_members member
      where member.site_id = site.id and member.role = 'owner'
    ) <> 1
    or not exists (
      select 1 from public.site_members member
      where member.site_id = site.id and member.user_id = site.owner_id and member.role = 'owner'
    )
  ) then
    raise exception 'Access control migration: a site has no single owner membership matching sites.owner_id';
  end if;

  if exists (
    select 1 from public.pages
    where not is_homepage and slug !~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
  ) or exists (
    select 1 from public.sites where slug !~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
  ) then
    raise exception 'Access control migration: a page or site slug does not match the slug format';
  end if;

  if exists (
    select 1 from public.pages page
    join public.page_published_revisions revision on revision.id = page.published_revision_id
    where revision.page_id <> page.id
  ) or exists (
    select 1 from public.pages page
    join public.page_revisions revision on revision.id = page.concept_revision_id
    where revision.page_id <> page.id
  ) or exists (
    select 1 from public.content_records record
    join public.content_record_published_revisions revision on revision.id = record.published_revision_id
    where revision.record_id <> record.id
  ) then
    raise exception 'Access control migration: a page or record points at a revision it does not own';
  end if;
end;
$preflight$;

-------------------------------------------------------------------------------------------------
-- 1.2 and 1.3: permission helpers
--
-- Owners and administrators have full-site access; scope and sections do not restrict them.
-- Publishers, editors and viewers are restricted by access scope (full, languages, branches) and,
-- for writes, by product sections. Publishers may publish; editors may not.
-------------------------------------------------------------------------------------------------

create or replace function private.has_language_access(
  target_language_id uuid,
  target_user_id uuid,
  target_section text,
  target_capability text
)
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
      and (
        member.role in ('owner', 'admin')
        or (
          case target_capability
            when 'read' then true
            when 'edit' then member.role in ('publisher', 'editor')
            when 'publish' then member.role = 'publisher'
            else false
          end
          and (target_section is null or target_section = any(member.sections))
          and (
            member.access_scope = 'full'
            or (member.access_scope = 'languages' and language.id = any(member.language_ids))
          )
        )
      )
  );
$$;

create or replace function private.page_within_branches(target_page_id uuid, branch_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive ancestors as (
    select page.id, page.parent_id
    from public.pages page
    where page.id = target_page_id
    union all
    select parent.id, parent.parent_id
    from public.pages parent
    join ancestors child on child.parent_id = parent.id
  ) cycle id set is_cycle using visited
  select exists (
    select 1 from ancestors where not is_cycle and id = any(branch_ids)
  );
$$;

-- Page-level access. Branch-scoped members reach a page when it, or an ancestor, is one of their
-- branches. Inserts check the parent page.
create or replace function private.has_page_access(
  target_page_id uuid,
  target_user_id uuid,
  target_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pages page
    where page.id = target_page_id
      and (
        private.has_language_access(page.site_language_id, target_user_id, 'pages', target_capability)
        or exists (
          select 1
          from public.site_languages language
          join public.site_members member on member.site_id = language.site_id
          where language.id = page.site_language_id
            and member.user_id = target_user_id
            and member.access_scope = 'branches'
            and 'pages' = any(member.sections)
            and case target_capability
              when 'edit' then member.role in ('publisher', 'editor')
              when 'publish' then member.role = 'publisher'
              else false
            end
            and private.page_within_branches(page.id, member.branch_ids)
        )
      )
  );
$$;

create or replace function private.can_publish_page(target_page_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_page_access(target_page_id, target_user_id, 'publish');
$$;

-- Read access to a language tree. Sections are not applied to reads (open question).
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
      and (
        member.role in ('owner', 'admin')
        or member.access_scope = 'full'
        or (member.access_scope = 'languages' and language.id = any(member.language_ids))
        or (
          member.access_scope = 'branches'
          and exists (
            select 1 from public.pages page
            where page.id = any(member.branch_ids) and page.site_language_id = language.id
          )
        )
      )
  );
$$;

-- Coarse gate kept for the function bodies wrapped below. It now includes publishers (1.3) and
-- respects scope. Every caller is additionally guarded by a precise check in this migration.
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
      and (
        member.role in ('owner', 'admin')
        or (
          member.role in ('publisher', 'editor')
          and (
            member.access_scope = 'full'
            or (member.access_scope = 'languages' and language.id = any(member.language_ids))
            or (
              member.access_scope = 'branches'
              and exists (
                select 1 from public.pages page
                where page.id = any(member.branch_ids) and page.site_language_id = language.id
              )
            )
          )
        )
      )
  );
$$;

revoke all on function private.has_language_access(uuid, uuid, text, text) from public, anon;
revoke all on function private.page_within_branches(uuid, uuid[]) from public, anon;
revoke all on function private.has_page_access(uuid, uuid, text) from public, anon;
revoke all on function private.can_publish_page(uuid, uuid) from public, anon;
grant execute on function private.has_language_access(uuid, uuid, text, text) to authenticated;
grant execute on function private.page_within_branches(uuid, uuid[]) to authenticated;
grant execute on function private.has_page_access(uuid, uuid, text) to authenticated;
grant execute on function private.can_publish_page(uuid, uuid) to authenticated;

-------------------------------------------------------------------------------------------------
-- 1.2 and 1.3: policies with scope, sections and the publish capability
-------------------------------------------------------------------------------------------------

drop policy if exists "Editors can create pages" on public.pages;
create policy "Editors can create pages"
on public.pages for insert to authenticated
with check (
  not is_homepage
  and status = 'concept'
  and published_revision_id is null
  and concept_revision_id is null
  and private.has_page_access(parent_id, (select auth.uid()), 'edit')
);

drop policy if exists "Editors can update pages" on public.pages;
create policy "Editors can update pages"
on public.pages for update to authenticated
using (private.has_page_access(id, (select auth.uid()), 'edit'))
with check (private.has_page_access(id, (select auth.uid()), 'edit'));

drop policy if exists "Editors can delete pages" on public.pages;
create policy "Editors can delete pages"
on public.pages for delete to authenticated
using (private.has_page_access(id, (select auth.uid()), 'edit'));

drop policy if exists "Editors can create content records" on public.content_records;
create policy "Editors can create content records"
on public.content_records for insert to authenticated
with check (
  private.has_language_access(site_language_id, (select auth.uid()), 'structured', 'edit')
  and (
    status = 'concept'
    or private.has_language_access(site_language_id, (select auth.uid()), 'structured', 'publish')
  )
);

drop policy if exists "Editors can update content records" on public.content_records;
create policy "Editors can update content records"
on public.content_records for update to authenticated
using (private.has_language_access(site_language_id, (select auth.uid()), 'structured', 'edit'))
with check (
  private.has_language_access(site_language_id, (select auth.uid()), 'structured', 'edit')
  and (
    status = 'concept'
    or private.has_language_access(site_language_id, (select auth.uid()), 'structured', 'publish')
  )
);

drop policy if exists "Editors can delete content records" on public.content_records;
create policy "Editors can delete content records"
on public.content_records for delete to authenticated
using (private.has_language_access(site_language_id, (select auth.uid()), 'structured', 'edit'));

do $policies$
declare
  item record;
begin
  for item in
    select * from (values
      ('content_types', 'content types', 'structured'),
      ('content_fields', 'content fields', 'structured'),
      ('page_templates', 'page templates', 'templates'),
      ('redirects', 'redirects', 'redirects')
    ) as section_table(table_name, label, section)
  loop
    execute format('drop policy if exists %I on public.%I', 'Editors can create ' || item.label, item.table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.has_language_access(site_language_id, (select auth.uid()), %L, ''edit''))',
      'Editors can create ' || item.label, item.table_name, item.section
    );
    execute format('drop policy if exists %I on public.%I', 'Editors can update ' || item.label, item.table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.has_language_access(site_language_id, (select auth.uid()), %L, ''edit'')) with check (private.has_language_access(site_language_id, (select auth.uid()), %L, ''edit''))',
      'Editors can update ' || item.label, item.table_name, item.section, item.section
    );
    execute format('drop policy if exists %I on public.%I', 'Editors can delete ' || item.label, item.table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.has_language_access(site_language_id, (select auth.uid()), %L, ''edit''))',
      'Editors can delete ' || item.label, item.table_name, item.section
    );
  end loop;
end;
$policies$;

drop policy if exists "Editors can create navigation menus" on public.navigation_menus;
create policy "Editors can create navigation menus"
on public.navigation_menus for insert to authenticated
with check (private.has_language_access(
  site_language_id, (select auth.uid()),
  case when location = 'footer' then 'footer' else 'navigation' end, 'edit'
));

drop policy if exists "Editors can update navigation menus" on public.navigation_menus;
create policy "Editors can update navigation menus"
on public.navigation_menus for update to authenticated
using (private.has_language_access(
  site_language_id, (select auth.uid()),
  case when location = 'footer' then 'footer' else 'navigation' end, 'edit'
))
with check (private.has_language_access(
  site_language_id, (select auth.uid()),
  case when location = 'footer' then 'footer' else 'navigation' end, 'edit'
));

-------------------------------------------------------------------------------------------------
-- 1.2 and 1.3: guard the SECURITY DEFINER content functions
--
-- Each original function moves to the private schema under an *_unchecked name, unchanged and not
-- executable by API roles. A public wrapper with the same signature performs the precise scope,
-- section and publish check first, then delegates. save_content_type is SECURITY INVOKER and is
-- covered by the structured-content policies above.
-------------------------------------------------------------------------------------------------

do $wrap$
declare
  item record;
begin
  for item in
    select * from (values
      ('save_page_revision', 'uuid, uuid, text, text, jsonb, text, text, text, text, text, boolean'),
      ('publish_page', 'uuid'),
      ('discard_page_concept', 'uuid'),
      ('publish_content_type_schema', 'uuid'),
      ('save_page_template', 'uuid, uuid, text, text, text, text, text, boolean, jsonb, text, jsonb'),
      ('set_fallback_page_template', 'uuid, uuid'),
      ('delete_page_template', 'uuid, uuid')
    ) as wrapped(function_name, argument_types)
  loop
    if to_regprocedure(format('private.%s_unchecked(%s)', item.function_name, item.argument_types)) is null then
      execute format('alter function public.%I(%s) set schema private', item.function_name, item.argument_types);
      execute format(
        'alter function private.%I(%s) rename to %I',
        item.function_name, item.argument_types, item.function_name || '_unchecked'
      );
    end if;

    execute format(
      'revoke all on function private.%I(%s) from public, anon, authenticated, service_role',
      item.function_name || '_unchecked', item.argument_types
    );
  end loop;
end;
$wrap$;

create or replace function public.save_page_revision(
  target_page_id uuid,
  expected_concept_revision_id uuid,
  target_title text,
  target_slug text,
  target_content_blocks jsonb,
  target_seo_title text,
  target_seo_description text,
  target_social_image text,
  target_preferred_child_template text,
  target_validation_status text,
  should_publish boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.pages where id = target_page_id for update;

  if not private.has_page_access(target_page_id, auth.uid(), 'edit') then
    raise exception 'You do not have permission to save this page' using errcode = '42501';
  end if;

  if should_publish and not private.can_publish_page(target_page_id, auth.uid()) then
    raise exception 'You do not have permission to publish this page' using errcode = '42501';
  end if;

  return private.save_page_revision_unchecked(
    target_page_id, expected_concept_revision_id, target_title, target_slug, target_content_blocks,
    target_seo_title, target_seo_description, target_social_image, target_preferred_child_template,
    target_validation_status, should_publish
  );
end;
$$;

create or replace function public.publish_page(target_page_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.pages where id = target_page_id for update;

  if not private.can_publish_page(target_page_id, auth.uid()) then
    raise exception 'You do not have permission to publish this page' using errcode = '42501';
  end if;

  return private.publish_page_unchecked(target_page_id);
end;
$$;

create or replace function public.discard_page_concept(target_page_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.pages where id = target_page_id for update;

  if not private.has_page_access(target_page_id, auth.uid(), 'edit') then
    raise exception 'You do not have permission to discard this concept' using errcode = '42501';
  end if;

  return private.discard_page_concept_unchecked(target_page_id);
end;
$$;

create or replace function public.publish_content_type_schema(target_content_type_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_language_id uuid;
begin
  select site_language_id into target_language_id
  from public.content_types where id = target_content_type_id for update;

  if not private.has_language_access(target_language_id, auth.uid(), 'structured', 'publish') then
    raise exception 'You do not have permission to publish this content type' using errcode = '42501';
  end if;

  return private.publish_content_type_schema_unchecked(target_content_type_id);
end;
$$;

create or replace function public.save_page_template(
  target_language_id uuid,
  target_template_id uuid,
  target_key text,
  target_name text,
  target_description text,
  target_icon text,
  target_status text,
  target_is_fallback boolean,
  target_defaults jsonb,
  target_preview_path text,
  target_components jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_language_access(target_language_id, auth.uid(), 'templates', 'edit') then
    raise exception 'You do not have permission to edit templates.' using errcode = '42501';
  end if;

  return private.save_page_template_unchecked(
    target_language_id, target_template_id, target_key, target_name, target_description, target_icon,
    target_status, target_is_fallback, target_defaults, target_preview_path, target_components
  );
end;
$$;

create or replace function public.set_fallback_page_template(
  target_language_id uuid,
  target_template_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_language_access(target_language_id, auth.uid(), 'templates', 'edit') then
    raise exception 'You do not have permission to edit templates.' using errcode = '42501';
  end if;

  perform private.set_fallback_page_template_unchecked(target_language_id, target_template_id);
end;
$$;

create or replace function public.delete_page_template(
  target_language_id uuid,
  target_template_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_language_access(target_language_id, auth.uid(), 'templates', 'edit') then
    raise exception 'You do not have permission to edit templates.' using errcode = '42501';
  end if;

  perform private.delete_page_template_unchecked(target_language_id, target_template_id);
end;
$$;

revoke all on function public.save_page_revision(uuid, uuid, text, text, jsonb, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.publish_page(uuid) from public, anon;
revoke all on function public.discard_page_concept(uuid) from public, anon;
revoke all on function public.publish_content_type_schema(uuid) from public, anon;
revoke all on function public.save_page_template(uuid, uuid, text, text, text, text, text, boolean, jsonb, text, jsonb) from public, anon;
revoke all on function public.set_fallback_page_template(uuid, uuid) from public, anon;
revoke all on function public.delete_page_template(uuid, uuid) from public, anon;
grant execute on function public.save_page_revision(uuid, uuid, text, text, jsonb, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.publish_page(uuid) to authenticated;
grant execute on function public.discard_page_concept(uuid) to authenticated;
grant execute on function public.publish_content_type_schema(uuid) to authenticated;
grant execute on function public.save_page_template(uuid, uuid, text, text, text, text, text, boolean, jsonb, text, jsonb) to authenticated;
grant execute on function public.set_fallback_page_template(uuid, uuid) to authenticated;
grant execute on function public.delete_page_template(uuid, uuid) to authenticated;

-------------------------------------------------------------------------------------------------
-- 1.1 and 1.8: site ownership and creation
-------------------------------------------------------------------------------------------------

-- owner_id is written only by the signup trigger and transfer_site_ownership.
revoke insert, update on public.sites from anon, authenticated;
grant update (name, slug, timezone, icon_url, preview_url) on public.sites to authenticated;

-- Sites are created by the signup trigger, which also inserts the owner membership.
drop policy if exists "Owners can create sites" on public.sites;

-- sites.owner_id and the single owner membership must always agree. Checked at commit so that the
-- signup trigger and transfer_site_ownership can change both sides in one transaction.
create or replace function private.check_site_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_site_id uuid;
begin
  if tg_table_name = 'sites' then
    target_site_id := new.id;
  elsif tg_op = 'DELETE' then
    target_site_id := old.site_id;
  else
    target_site_id := new.site_id;
  end if;

  if exists (select 1 from public.sites where id = target_site_id) and (
    (
      select count(*) from public.site_members
      where site_id = target_site_id and role = 'owner'
    ) <> 1
    or not exists (
      select 1
      from public.sites site
      join public.site_members member
        on member.site_id = site.id and member.user_id = site.owner_id and member.role = 'owner'
      where site.id = target_site_id
    )
  ) then
    raise exception 'A site must have exactly one owner membership matching its owner.'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke all on function private.check_site_ownership() from public, anon, authenticated;

drop trigger if exists sites_check_ownership on public.sites;
create constraint trigger sites_check_ownership
after insert or update of owner_id on public.sites
deferrable initially deferred
for each row execute function private.check_site_ownership();

drop trigger if exists site_members_check_ownership on public.site_members;
create constraint trigger site_members_check_ownership
after insert or update or delete on public.site_members
deferrable initially deferred
for each row execute function private.check_site_ownership();

-------------------------------------------------------------------------------------------------
-- 1.4: memberships change only through guarded functions
-------------------------------------------------------------------------------------------------

drop policy if exists "Settings managers can add memberships" on public.site_members;
drop policy if exists "Settings managers can update memberships" on public.site_members;
revoke insert, update on public.site_members from anon, authenticated;

-------------------------------------------------------------------------------------------------
-- 1.5: API tokens are issued and revoked by the database
-------------------------------------------------------------------------------------------------

drop policy if exists "Settings managers can create API tokens" on public.site_api_tokens;
drop policy if exists "Settings managers can revoke API tokens" on public.site_api_tokens;
revoke insert, update, delete on public.site_api_tokens from anon, authenticated;

create or replace function public.create_site_api_token(
  target_site_id uuid,
  target_name text,
  target_allowed_origins text[] default '{}',
  target_expires_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  secret text;
  created_id uuid;
  origin text;
begin
  if not private.can_manage_site_settings(target_site_id, auth.uid()) then
    raise exception 'You cannot manage API tokens for this site.' using errcode = '42501';
  end if;

  if target_expires_at is not null and target_expires_at <= now() then
    raise exception 'Token expiry must be in the future.' using errcode = '22023';
  end if;

  foreach origin in array coalesce(target_allowed_origins, '{}') loop
    if origin !~ '^https?://[^/?#[:space:]]+$' then
      raise exception 'Allowed origins must be origins without a path: %', origin using errcode = '22023';
    end if;
  end loop;

  -- 256 random bits, base64url without padding.
  secret := 'scaffold_pub_' || translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');

  insert into public.site_api_tokens (
    site_id, name, token_hash, token_prefix, token_suffix, allowed_origins, expires_at, created_by
  ) values (
    target_site_id,
    trim(target_name),
    encode(sha256(convert_to(secret, 'UTF8')), 'hex'),
    left(secret, 13),
    right(secret, 4),
    array(select distinct unnest(coalesce(target_allowed_origins, '{}'))),
    target_expires_at,
    auth.uid()
  )
  returning id into created_id;

  return jsonb_build_object('id', created_id, 'token', secret);
end;
$$;

create or replace function public.revoke_site_api_token(target_token_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_site_id uuid;
begin
  select site_id into token_site_id
  from public.site_api_tokens where id = target_token_id for update;

  if token_site_id is null or not private.can_manage_site_settings(token_site_id, auth.uid()) then
    raise exception 'You cannot manage API tokens for this site.' using errcode = '42501';
  end if;

  update public.site_api_tokens
  set revoked_at = coalesce(revoked_at, now())
  where id = target_token_id;
end;
$$;

revoke all on function public.create_site_api_token(uuid, text, text[], timestamptz) from public, anon;
revoke all on function public.revoke_site_api_token(uuid) from public, anon;
grant execute on function public.create_site_api_token(uuid, text, text[], timestamptz) to authenticated;
grant execute on function public.revoke_site_api_token(uuid) to authenticated;

-------------------------------------------------------------------------------------------------
-- 1.6: revisions belong to their page or record; function-managed columns are not writable
-------------------------------------------------------------------------------------------------

alter table public.page_published_revisions
  drop constraint if exists page_published_revisions_id_page_key,
  add constraint page_published_revisions_id_page_key unique (id, page_id);

alter table public.page_revisions
  drop constraint if exists page_revisions_id_page_key,
  add constraint page_revisions_id_page_key unique (id, page_id);

alter table public.content_record_published_revisions
  drop constraint if exists content_record_published_revisions_id_record_key,
  add constraint content_record_published_revisions_id_record_key unique (id, record_id);

alter table public.pages
  drop constraint if exists pages_published_revision_id_fkey,
  drop constraint if exists pages_published_revision_page_fkey,
  add constraint pages_published_revision_page_fkey
    foreign key (published_revision_id, id)
    references public.page_published_revisions (id, page_id)
    on delete set null (published_revision_id);

alter table public.pages
  drop constraint if exists pages_concept_revision_id_fkey,
  drop constraint if exists pages_concept_revision_page_fkey,
  add constraint pages_concept_revision_page_fkey
    foreign key (concept_revision_id, id)
    references public.page_revisions (id, page_id)
    on delete set null (concept_revision_id)
    deferrable initially deferred;

alter table public.content_records
  drop constraint if exists content_records_published_revision_id_fkey,
  drop constraint if exists content_records_published_revision_record_fkey,
  add constraint content_records_published_revision_record_fkey
    foreign key (published_revision_id, id)
    references public.content_record_published_revisions (id, record_id)
    on delete set null (published_revision_id);

-- Tree position, URL, lifecycle and revision pointers change only through move_page,
-- save_page_revision, publish_page and discard_page_concept.
revoke insert, update on public.pages from anon, authenticated;
grant insert (
  site_language_id, parent_id, title, slug, template_name, status, validation_status, position,
  content_blocks, seo_title, seo_description, social_image, preferred_child_template,
  created_from_template_key, created_from_template_id
) on public.pages to authenticated;
grant update (
  title, template_name, validation_status, position, content_blocks, seo_title, seo_description,
  social_image, preferred_child_template, created_from_template_key, created_from_template_id
) on public.pages to authenticated;

-- published_revision_id is maintained by the publish snapshot trigger only.
revoke insert, update on public.content_records from anon, authenticated;
grant insert (content_type_id, site_language_id, status, values) on public.content_records to authenticated;
grant update (content_type_id, site_language_id, status, values) on public.content_records to authenticated;

-------------------------------------------------------------------------------------------------
-- 1.7: no cycles in the page tree
-------------------------------------------------------------------------------------------------

alter table public.pages
  drop constraint if exists pages_not_own_parent,
  add constraint pages_not_own_parent check (parent_id is null or parent_id <> id);

create or replace function private.lock_page_tree(target_language_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('scaffold.page_tree:' || target_language_id::text, 0)
  );
$$;

revoke all on function private.lock_page_tree(uuid) from public, anon;
grant execute on function private.lock_page_tree(uuid) to authenticated;

create or replace function private.page_path(target_page_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  with recursive ancestors as (
    select id, parent_id, slug, is_homepage, 0 as depth
    from public.pages where id = target_page_id
    union all
    select parent.id, parent.parent_id, parent.slug, parent.is_homepage, child.depth + 1
    from public.pages parent
    join ancestors child on child.parent_id = parent.id
  ) cycle id set is_cycle using visited
  select coalesce(
    '/' || string_agg(slug, '/' order by depth desc) filter (where not is_homepage and not is_cycle),
    '/'
  )
  from ancestors;
$$;

create or replace function public.validate_page_tree()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_language_id uuid;
begin
  perform private.lock_page_tree(new.site_language_id);

  if new.parent_id is not null then
    select site_language_id into parent_language_id
    from public.pages
    where id = new.parent_id;

    if parent_language_id is null or parent_language_id <> new.site_language_id then
      raise exception 'A page parent must exist in the same language tree';
    end if;
  end if;

  -- The new parent must not be the page itself or one of its descendants.
  if tg_op = 'UPDATE' and new.parent_id is not null and exists (
    with recursive ancestors as (
      select page.id, page.parent_id from public.pages page where page.id = new.parent_id
      union all
      select parent.id, parent.parent_id
      from public.pages parent
      join ancestors child on child.parent_id = parent.id
    ) cycle id set is_cycle using visited
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'A page cannot be moved beneath one of its descendants';
  end if;

  return new;
end;
$$;

-- move_page now runs as SECURITY DEFINER because API roles can no longer write parent_id. It
-- checks page-level access for the moved page and its destination, serialises tree changes per
-- language, and guards every recursive query against cycles.
create or replace function public.move_page(
  moving_page_id uuid,
  target_page_id uuid,
  drop_position text,
  create_redirects boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  moving_page public.pages%rowtype;
  target_page public.pages%rowtype;
  tree_language_id uuid;
  old_parent_id uuid;
  new_parent_id uuid;
  target_order integer;
  moved_count integer;
  published_count integer;
  parent_title text;
  old_paths jsonb;
  path_entry record;
  new_path text;
  redirect_count integer := 0;
begin
  if drop_position not in ('before', 'inside', 'after') then raise exception 'Unknown drop position'; end if;

  select site_language_id into tree_language_id from public.pages where id = moving_page_id;
  if tree_language_id is not null then perform private.lock_page_tree(tree_language_id); end if;

  select * into moving_page from public.pages where id = moving_page_id for update;
  select * into target_page from public.pages where id = target_page_id for update;
  if moving_page.id is null or target_page.id is null then raise exception 'The source or destination page no longer exists'; end if;
  if moving_page.is_homepage then raise exception 'The homepage is fixed to the tree root'; end if;
  if moving_page.site_language_id <> target_page.site_language_id then raise exception 'Pages cannot be moved between language trees'; end if;
  if moving_page.id = target_page.id then raise exception 'A page cannot be dropped onto itself'; end if;

  old_parent_id := moving_page.parent_id;
  if target_page.is_homepage or drop_position = 'inside' then
    new_parent_id := target_page.id;
    drop_position := 'inside';
  else
    new_parent_id := target_page.parent_id;
  end if;
  if new_parent_id is null then raise exception 'Only the homepage may live at the tree root'; end if;

  if not private.has_page_access(moving_page.id, auth.uid(), 'edit')
    or not private.has_page_access(new_parent_id, auth.uid(), 'edit') then
    raise exception 'You do not have permission to move this page' using errcode = '42501';
  end if;

  if exists (
    with recursive descendants as (
      select id from public.pages where parent_id = moving_page.id
      union all
      select page.id from public.pages page join descendants on page.parent_id = descendants.id
    ) cycle id set is_cycle using visited
    select 1 from descendants where id = target_page.id
  ) then raise exception 'A page cannot be moved beneath one of its descendants'; end if;

  if new_parent_id <> old_parent_id and exists (
    select 1 from public.pages
    where parent_id = new_parent_id and slug = moving_page.slug and id <> moving_page.id
  ) then raise exception 'A page with this URL slug already exists at the destination'; end if;

  with recursive subtree as (
    select id, status from public.pages where id = moving_page.id
    union all
    select page.id, page.status from public.pages page join subtree on page.parent_id = subtree.id
  ) cycle id set is_cycle using visited
  select count(*), count(*) filter (where status = 'published'),
    coalesce(jsonb_object_agg(id::text, private.page_path(id)) filter (where status = 'published'), '{}'::jsonb)
  into moved_count, published_count, old_paths
  from subtree
  where not is_cycle;

  with ordered as (
    select id, row_number() over (order by position, title, id) * 10 as next_position
    from public.pages where parent_id = new_parent_id and id <> moving_page.id
  )
  update public.pages page set position = ordered.next_position
  from ordered where page.id = ordered.id;

  if drop_position = 'inside' then
    select coalesce(max(position), 0) + 10 into target_order
    from public.pages where parent_id = new_parent_id and id <> moving_page.id;
  else
    select position into target_order from public.pages where id = target_page.id;
    if drop_position = 'before' then target_order := target_order - 5;
    else target_order := target_order + 5;
    end if;
  end if;

  update public.pages set parent_id = new_parent_id, position = target_order
  where id = moving_page.id;

  with affected_parents(parent_id) as (select old_parent_id union select new_parent_id),
  ordered as (
    select page.id,
      row_number() over (partition by page.parent_id order by page.position, page.title, page.id) - 1 as next_position
    from public.pages page
    join affected_parents on affected_parents.parent_id = page.parent_id
  )
  update public.pages page set position = ordered.next_position
  from ordered where page.id = ordered.id;

  if create_redirects then
    for path_entry in select key, value from jsonb_each_text(old_paths)
    loop
      new_path := private.page_path(path_entry.key::uuid);
      if new_path <> path_entry.value then
        insert into public.redirects (site_language_id, page_id, source_path, destination_path)
        values (moving_page.site_language_id, path_entry.key::uuid, path_entry.value, new_path);
        redirect_count := redirect_count + 1;
      end if;
    end loop;
  end if;

  select title into parent_title from public.pages where id = new_parent_id;
  return jsonb_build_object(
    'reparented', old_parent_id <> new_parent_id,
    'parentTitle', parent_title,
    'affectedPages', moved_count,
    'publishedPages', published_count,
    'redirectsCreated', redirect_count
  );
end;
$$;

revoke all on function public.move_page(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.move_page(uuid, uuid, text, boolean) to authenticated;

-------------------------------------------------------------------------------------------------
-- 1.9: URL-safe slugs (same rule as content_types.slug, allowing repeated hyphens inside)
-------------------------------------------------------------------------------------------------

alter table public.pages
  drop constraint if exists pages_slug_format,
  add constraint pages_slug_format
    check (is_homepage or slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$');

alter table public.sites
  drop constraint if exists sites_slug_format,
  add constraint sites_slug_format
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$');

-------------------------------------------------------------------------------------------------
-- 1.10: the legacy three-argument move_page moved published pages without redirects
-------------------------------------------------------------------------------------------------

drop function if exists public.move_page(uuid, uuid, text);
