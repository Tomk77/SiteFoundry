create table if not exists public.page_published_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  site_language_id uuid not null references public.site_languages(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  published_by uuid references auth.users(id) on delete set null default auth.uid(),
  published_at timestamptz not null default now(),
  unique (page_id, version)
);

alter table public.pages
add column if not exists published_revision_id uuid references public.page_published_revisions(id) on delete set null;

create index if not exists page_published_revisions_page_idx
on public.page_published_revisions (page_id, version desc);

alter table public.page_published_revisions enable row level security;

drop policy if exists "Members can read published page revisions" on public.page_published_revisions;
create policy "Members can read published page revisions"
on public.page_published_revisions for select to authenticated
using (private.is_language_member(site_language_id, (select auth.uid())));

create or replace function private.page_snapshot(page public.pages)
returns jsonb
language sql
stable
set search_path = public, private
as $$
  select jsonb_build_object(
    'id', page.id,
    'parentId', page.parent_id,
    'languageId', page.site_language_id,
    'title', page.title,
    'slug', page.slug,
    'path', private.page_path(page.id),
    'templateName', page.template_name,
    'templateKey', page.created_from_template_key,
    'blocks', coalesce((
      select jsonb_agg(
        case when block.value ? 'version'
          then block.value
          else block.value || jsonb_build_object('version', 1)
        end
        order by block.ordinality
      )
      from jsonb_array_elements(page.content_blocks) with ordinality block(value, ordinality)
    ), '[]'::jsonb),
    'seo', jsonb_build_object(
      'title', page.seo_title,
      'description', page.seo_description,
      'socialImage', page.social_image
    ),
    'preferredChildTemplate', page.preferred_child_template,
    'createdAt', page.created_at,
    'updatedAt', page.updated_at
  );
$$;

create or replace function public.publish_page(target_page_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  page public.pages%rowtype;
  next_version integer;
  revision_id uuid;
begin
  select * into page from public.pages where id = target_page_id for update;
  if page.id is null then raise exception 'Page not found'; end if;
  if not private.can_edit_language(page.site_language_id, auth.uid()) then
    raise exception 'You do not have permission to publish this page';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.page_published_revisions where page_id = page.id;

  insert into public.page_published_revisions (
    page_id, site_language_id, version, snapshot
  ) values (
    page.id, page.site_language_id, next_version, private.page_snapshot(page)
  ) returning id into revision_id;

  update public.pages
  set status = 'published', published_revision_id = revision_id
  where id = page.id;

  return revision_id;
end;
$$;

revoke all on function public.publish_page(uuid) from public, anon;
grant execute on function public.publish_page(uuid) to authenticated;

alter table public.content_types
add column if not exists published_schema jsonb,
add column if not exists published_schema_version integer not null default 0,
add column if not exists schema_published_at timestamptz;

update public.content_types content_type
set
  published_schema = jsonb_build_object(
    'fields', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', field.key,
        'label', field.label,
        'type', field.field_type,
        'required', field.is_required,
        'primary', field.is_primary,
        'options', field.options
      ) order by field.position)
      from public.content_fields field where field.content_type_id = content_type.id
    ), '[]'::jsonb)
  ),
  published_schema_version = 1,
  schema_published_at = content_type.updated_at
where content_type.published_schema is null;

create or replace function public.publish_content_type_schema(target_content_type_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  content_type public.content_types%rowtype;
  next_version integer;
begin
  select * into content_type
  from public.content_types where id = target_content_type_id for update;
  if content_type.id is null then raise exception 'Content type not found'; end if;
  if not private.can_edit_language(content_type.site_language_id, auth.uid()) then
    raise exception 'You do not have permission to publish this schema';
  end if;
  next_version := content_type.published_schema_version + 1;

  update public.content_types
  set
    published_schema = jsonb_build_object(
      'fields', coalesce((
        select jsonb_agg(jsonb_build_object(
          'key', field.key,
          'label', field.label,
          'type', field.field_type,
          'required', field.is_required,
          'primary', field.is_primary,
          'options', field.options
        ) order by field.position)
        from public.content_fields field where field.content_type_id = content_type.id
      ), '[]'::jsonb)
    ),
    published_schema_version = next_version,
    schema_published_at = now()
  where id = content_type.id;

  return next_version;
end;
$$;

revoke all on function public.publish_content_type_schema(uuid) from public, anon;
grant execute on function public.publish_content_type_schema(uuid) to authenticated;

insert into public.page_published_revisions (
  page_id, site_language_id, version, snapshot, published_at
)
select page.id, page.site_language_id, 1, private.page_snapshot(page), page.updated_at
from public.pages page
where page.status = 'published' and page.published_revision_id is null
on conflict (page_id, version) do nothing;

update public.pages page
set published_revision_id = revision.id
from public.page_published_revisions revision
where revision.page_id = page.id
  and revision.version = (
    select max(latest.version)
    from public.page_published_revisions latest
    where latest.page_id = page.id
  )
  and page.published_revision_id is null;

create table if not exists public.content_record_published_revisions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.content_records(id) on delete cascade,
  content_type_id uuid not null references public.content_types(id) on delete cascade,
  site_language_id uuid not null references public.site_languages(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  published_by uuid references auth.users(id) on delete set null default auth.uid(),
  published_at timestamptz not null default now(),
  unique (record_id, version)
);

alter table public.content_records
add column if not exists published_revision_id uuid references public.content_record_published_revisions(id) on delete set null;

alter table public.content_record_published_revisions enable row level security;

drop policy if exists "Members can read published content revisions" on public.content_record_published_revisions;
create policy "Members can read published content revisions"
on public.content_record_published_revisions for select to authenticated
using (private.is_language_member(site_language_id, (select auth.uid())));

create or replace function private.snapshot_published_content_record()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  next_version integer;
  revision_id uuid;
begin
  if new.status <> 'published' then return new; end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.content_record_published_revisions where record_id = new.id;

  insert into public.content_record_published_revisions (
    record_id, content_type_id, site_language_id, version, snapshot, published_by
  ) values (
    new.id,
    new.content_type_id,
    new.site_language_id,
    next_version,
    jsonb_build_object('id', new.id, 'values', new.values),
    auth.uid()
  ) returning id into revision_id;

  update public.content_records
  set published_revision_id = revision_id
  where id = new.id;

  return new;
end;
$$;

insert into public.content_record_published_revisions (
  record_id, content_type_id, site_language_id, version, snapshot, published_at
)
select
  record.id,
  record.content_type_id,
  record.site_language_id,
  1,
  jsonb_build_object('id', record.id, 'values', record.values),
  record.updated_at
from public.content_records record
where record.status = 'published' and record.published_revision_id is null
on conflict (record_id, version) do nothing;

update public.content_records record
set published_revision_id = revision.id
from public.content_record_published_revisions revision
where revision.record_id = record.id
  and revision.version = (
    select max(latest.version)
    from public.content_record_published_revisions latest
    where latest.record_id = record.id
  )
  and record.published_revision_id is null;

drop trigger if exists content_records_snapshot_published on public.content_records;
create trigger content_records_snapshot_published
after insert or update of values, status on public.content_records
for each row
when (new.status = 'published')
execute function private.snapshot_published_content_record();

create table if not exists public.site_api_tokens (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  token_prefix text not null check (length(token_prefix) between 8 and 20),
  token_suffix text not null check (length(token_suffix) = 4),
  scopes text[] not null default array['published:read']::text[],
  allowed_origins text[] not null default '{}',
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  rate_limit_per_minute integer not null default 600 check (rate_limit_per_minute between 60 and 6000),
  rate_window_started_at timestamptz not null default now(),
  rate_request_count integer not null default 0 check (rate_request_count >= 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (scopes <@ array['published:read']::text[])
);

create index if not exists site_api_tokens_site_created_idx
on public.site_api_tokens (site_id, created_at desc);

alter table public.site_api_tokens enable row level security;

drop policy if exists "Settings managers can read API tokens" on public.site_api_tokens;
create policy "Settings managers can read API tokens"
on public.site_api_tokens for select to authenticated
using (private.can_manage_site_settings(site_id, (select auth.uid())));

drop policy if exists "Settings managers can create API tokens" on public.site_api_tokens;
create policy "Settings managers can create API tokens"
on public.site_api_tokens for insert to authenticated
with check (
  private.can_manage_site_settings(site_id, (select auth.uid()))
  and created_by = (select auth.uid())
);

drop policy if exists "Settings managers can revoke API tokens" on public.site_api_tokens;
create policy "Settings managers can revoke API tokens"
on public.site_api_tokens for update to authenticated
using (private.can_manage_site_settings(site_id, (select auth.uid())))
with check (private.can_manage_site_settings(site_id, (select auth.uid())));

create or replace function public.get_delivery_bundle(
  target_site_key text,
  target_token_hash text,
  target_origin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_site public.sites%rowtype;
  selected_token public.site_api_tokens%rowtype;
  result jsonb;
begin
  select * into selected_site
  from public.sites site where site.slug = target_site_key;
  if selected_site.id is null then
    raise exception using errcode = '28000', message = 'Invalid delivery token';
  end if;

  select * into selected_token
  from public.site_api_tokens token
  where token.site_id = selected_site.id
    and token.token_hash = lower(target_token_hash)
    and token.revoked_at is null
    and (token.expires_at is null or token.expires_at > now())
    and 'published:read' = any(token.scopes);

  if selected_token.id is null then
    raise exception using errcode = '28000', message = 'Invalid delivery token';
  end if;

  if target_origin is not null
    and cardinality(selected_token.allowed_origins) > 0
    and not (target_origin = any(selected_token.allowed_origins)) then
    raise exception using errcode = '42501', message = 'Origin is not allowed for this token';
  end if;

  update public.site_api_tokens
  set
    last_used_at = case
      when last_used_at is null or last_used_at < now() - interval '5 minutes' then now()
      else last_used_at
    end,
    rate_window_started_at = case
      when rate_window_started_at < now() - interval '1 minute' then now()
      else rate_window_started_at
    end,
    rate_request_count = case
      when rate_window_started_at < now() - interval '1 minute' then 1
      else rate_request_count + 1
    end
  where id = selected_token.id
  returning * into selected_token;

  if selected_token.rate_request_count > selected_token.rate_limit_per_minute then
    raise exception using errcode = '54000', message = 'Delivery rate limit exceeded';
  end if;

  select jsonb_build_object(
    'site', jsonb_build_object(
      'id', site.id,
      'key', site.slug,
      'name', site.name,
      'timezone', site.timezone,
      'domains', coalesce((
        select jsonb_agg(jsonb_build_object(
          'hostname', domain.hostname,
          'primary', domain.is_primary
        ) order by domain.is_primary desc, domain.created_at)
        from public.site_domains domain
        where domain.site_id = site.id and domain.status = 'verified'
      ), '[]'::jsonb)
    ),
    'languages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', language.id,
        'code', language.code,
        'name', language.name,
        'default', language.is_default,
        'urlPrefix', language.url_prefix
      ) order by language.position)
      from public.site_languages language where language.site_id = site.id
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(
        revision.snapshot || jsonb_build_object(
          'revisionId', revision.id,
          'revisionVersion', revision.version,
          'publishedAt', revision.published_at,
          'locale', language.code
        ) order by language.position, revision.published_at desc, revision.page_id
      )
      from public.pages page
      join public.site_languages language on language.id = page.site_language_id
      join public.page_published_revisions revision on revision.id = page.published_revision_id
      where language.site_id = site.id
    ), '[]'::jsonb),
    'contentTypes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', content_type.id,
        'slug', content_type.slug,
        'name', content_type.name,
        'singularName', content_type.singular_name,
        'description', content_type.description,
        'locale', language.code,
        'schemaVersion', content_type.published_schema_version,
        'schemaPublishedAt', content_type.schema_published_at,
        'fields', coalesce(content_type.published_schema -> 'fields', '[]'::jsonb),
        'records', coalesce((
          select jsonb_agg(
            revision.snapshot || jsonb_build_object(
              'revisionId', revision.id,
              'revisionVersion', revision.version,
              'publishedAt', revision.published_at,
              'locale', language.code,
              'contentType', content_type.slug
            ) order by revision.published_at desc, revision.record_id
          )
          from public.content_records record
          join public.content_record_published_revisions revision
            on revision.id = record.published_revision_id
          where record.content_type_id = content_type.id
        ), '[]'::jsonb)
      ) order by language.position, content_type.position)
      from public.content_types content_type
      join public.site_languages language on language.id = content_type.site_language_id
      where language.site_id = site.id and content_type.published_schema_version > 0
    ), '[]'::jsonb),
    'navigation', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', menu.id,
        'locale', language.code,
        'location', menu.location,
        'items', menu.published_items,
        'publishedAt', menu.published_at
      ) order by language.position, menu.location)
      from public.navigation_menus menu
      join public.site_languages language on language.id = menu.site_language_id
      where language.site_id = site.id and menu.published_at is not null
    ), '[]'::jsonb),
    'redirects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', redirect.id,
        'locale', language.code,
        'sourcePath', redirect.source_path,
        'destinationPath', redirect.destination_path,
        'statusCode', redirect.status_code
      ) order by language.position, redirect.source_path)
      from public.redirects redirect
      join public.site_languages language on language.id = redirect.site_language_id
      where language.site_id = site.id
    ), '[]'::jsonb),
    'media', '[]'::jsonb
  ) into result
  from public.sites site where site.id = selected_site.id;

  return result;
end;
$$;

revoke all on function public.get_delivery_bundle(text, text, text) from public, anon, authenticated;
grant execute on function public.get_delivery_bundle(text, text, text) to anon, authenticated;
