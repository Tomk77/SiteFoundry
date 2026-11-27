-- WP3 findings 3.5 and 3.9.
--
-- 3.5: get_delivery_bundle took a caller-supplied SHA-256 hash, so a leaked hash (for example from a
-- database dump) was directly usable. It now takes the raw token and hashes it itself. The parameter
-- name changes, so the function is dropped and recreated; the application must deploy together with
-- this migration. The origin allowlist remains advisory: publishable tokens are public by design and
-- a non-browser client can send any Origin header (see ADR 0007).
--
-- 3.9: the stored token prefix was the constant `scaffold_pub_`, which identified nothing. New
-- tokens store the first 17 characters, so tokens can be told apart in Site Settings.

drop function if exists public.get_delivery_bundle(text, text, text);

create or replace function public.get_delivery_bundle(
  target_site_key text,
  target_token text,
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
    and token.token_hash = encode(sha256(convert_to(coalesce(target_token, ''), 'UTF8')), 'hex')
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
    left(secret, 17),
    right(secret, 4),
    array(select distinct unnest(coalesce(target_allowed_origins, '{}'))),
    target_expires_at,
    auth.uid()
  )
  returning id into created_id;

  return jsonb_build_object('id', created_id, 'token', secret);
end;
$$;

revoke all on function public.create_site_api_token(uuid, text, text[], timestamptz) from public, anon;
grant execute on function public.create_site_api_token(uuid, text, text[], timestamptz) to authenticated;
