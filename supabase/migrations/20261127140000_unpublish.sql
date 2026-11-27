-- WP2 finding 2.1: pages and structured records can be unpublished, and delivery only serves rows
-- whose status is published (defence in depth). Page and record selection moves into private
-- helpers so later changes do not have to restate the whole bundle.

-------------------------------------------------------------------------------------------------
-- Delivery helpers
-------------------------------------------------------------------------------------------------

create or replace function private.delivery_pages(target_site_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
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
    where language.site_id = target_site_id
      and page.status = 'published'
  ), '[]'::jsonb);
$$;

create or replace function private.delivery_records(
  target_content_type_id uuid,
  target_locale text,
  target_content_type_slug text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(
      revision.snapshot || jsonb_build_object(
        'revisionId', revision.id,
        'revisionVersion', revision.version,
        'publishedAt', revision.published_at,
        'locale', target_locale,
        'contentType', target_content_type_slug
      ) order by revision.published_at desc, revision.record_id
    )
    from public.content_records record
    join public.content_record_published_revisions revision
      on revision.id = record.published_revision_id
    where record.content_type_id = target_content_type_id
      and record.status = 'published'
  ), '[]'::jsonb);
$$;

revoke all on function private.delivery_pages(uuid) from public, anon, authenticated;
revoke all on function private.delivery_records(uuid, text, text) from public, anon, authenticated;

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

-------------------------------------------------------------------------------------------------
-- Unpublish a page: it leaves delivery, its concept and revision history stay.
-------------------------------------------------------------------------------------------------

create or replace function public.unpublish_page(target_page_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  page public.pages%rowtype;
begin
  select * into page from public.pages where id = target_page_id for update;

  if not private.can_publish_page(target_page_id, auth.uid()) then
    raise exception 'You do not have permission to unpublish this page' using errcode = '42501';
  end if;

  if page.is_homepage then
    raise exception 'The homepage cannot be unpublished' using errcode = '22023';
  end if;

  update public.pages
  set status = 'concept', published_revision_id = null
  where id = target_page_id;
end;
$$;

revoke all on function public.unpublish_page(uuid) from public, anon;
grant execute on function public.unpublish_page(uuid) to authenticated;

-------------------------------------------------------------------------------------------------
-- Unpublish a record: setting it back to concept clears its published revision pointer. Records
-- still have no separate concept stage, so editing a published record republishes it.
-------------------------------------------------------------------------------------------------

create or replace function private.clear_unpublished_content_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'concept' then
    new.published_revision_id := null;
  end if;

  return new;
end;
$$;

revoke all on function private.clear_unpublished_content_record() from public, anon, authenticated;

drop trigger if exists content_records_clear_unpublished on public.content_records;
create trigger content_records_clear_unpublished
before update of status on public.content_records
for each row
when (old.status = 'published' and new.status = 'concept')
execute function private.clear_unpublished_content_record();
