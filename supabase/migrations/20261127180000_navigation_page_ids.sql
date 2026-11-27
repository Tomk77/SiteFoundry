-- WP2 finding 2.6: navigation items of type "page" stored only the path, so a move or slug change
-- broke menus, and the admin created menu rows on read.
--
-- Page items now carry `pageId`. Delivery resolves their `target` from the live tree at read time
-- (falling back to the stored path for legacy items or pages that are not published). Every language
-- gets its header and footer menu when it is created, and existing items are linked to their pages.

create or replace function private.resolve_navigation_items(items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  item jsonb;
  resolved jsonb := '[]'::jsonb;
  page_id uuid;
  live_path text;
begin
  if jsonb_typeof(items) is distinct from 'array' then
    return '[]'::jsonb;
  end if;

  for item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(item) = 'object' then
      if item ->> 'targetType' = 'page'
        and coalesce(item ->> 'pageId', '') ~ '^[0-9a-f-]{36}$' then
        page_id := (item ->> 'pageId')::uuid;
        select private.published_page_path(page.id) into live_path
        from public.pages page
        where page.id = page_id and page.status = 'published';

        if live_path is not null then
          item := item || jsonb_build_object('target', live_path);
        end if;
      end if;

      if item ? 'children' then
        item := item || jsonb_build_object(
          'children', private.resolve_navigation_items(item -> 'children')
        );
      end if;
    end if;

    resolved := resolved || jsonb_build_array(item);
  end loop;

  return resolved;
end;
$$;

-- Adds `pageId` to page items whose stored path matches a page in the language.
create or replace function private.attach_navigation_page_ids(target_language_id uuid, items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  item jsonb;
  attached jsonb := '[]'::jsonb;
  page_id uuid;
begin
  if jsonb_typeof(items) is distinct from 'array' then
    return items;
  end if;

  for item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(item) = 'object' then
      if item ->> 'targetType' = 'page' and not item ? 'pageId' then
        select page.id into page_id
        from public.pages page
        where page.site_language_id = target_language_id
          and private.page_path(page.id) = item ->> 'target'
        limit 1;

        if page_id is not null then
          item := item || jsonb_build_object('pageId', page_id);
        end if;
      end if;

      if item ? 'children' then
        item := item || jsonb_build_object(
          'children', private.attach_navigation_page_ids(target_language_id, item -> 'children')
        );
      end if;
    end if;

    attached := attached || jsonb_build_array(item);
  end loop;

  return attached;
end;
$$;

create or replace function private.delivery_navigation(target_site_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', menu.id,
      'locale', language.code,
      'location', menu.location,
      'items', private.resolve_navigation_items(menu.published_items),
      'publishedAt', menu.published_at
    ) order by language.position, menu.location)
    from public.navigation_menus menu
    join public.site_languages language on language.id = menu.site_language_id
    where language.site_id = target_site_id and menu.published_at is not null
  ), '[]'::jsonb);
$$;

create or replace function private.create_language_menus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.navigation_menus (site_language_id, location)
  values (new.id, 'header'), (new.id, 'footer')
  on conflict (site_language_id, location) do nothing;

  return new;
end;
$$;

revoke all on function private.resolve_navigation_items(jsonb) from public, anon, authenticated;
revoke all on function private.attach_navigation_page_ids(uuid, jsonb) from public, anon, authenticated;
revoke all on function private.delivery_navigation(uuid) from public, anon, authenticated;
revoke all on function private.create_language_menus() from public, anon, authenticated;

drop trigger if exists site_languages_create_menus on public.site_languages;
create trigger site_languages_create_menus
after insert on public.site_languages
for each row execute function private.create_language_menus();

-- Backfill: every language has both menus, and existing page items know their page.
insert into public.navigation_menus (site_language_id, location)
select language.id, location.name
from public.site_languages language
cross join (values ('header'), ('footer')) as location(name)
on conflict (site_language_id, location) do nothing;

update public.navigation_menus
set draft_items = private.attach_navigation_page_ids(site_language_id, draft_items),
    published_items = private.attach_navigation_page_ids(site_language_id, published_items);

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
    'pages', private.delivery_pages(site.id),
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
        'records', private.delivery_records(content_type.id, language.code, content_type.slug)
      ) order by language.position, content_type.position)
      from public.content_types content_type
      join public.site_languages language on language.id = content_type.site_language_id
      where language.site_id = site.id and content_type.published_schema_version > 0
    ), '[]'::jsonb),
    'navigation', private.delivery_navigation(site.id),
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
