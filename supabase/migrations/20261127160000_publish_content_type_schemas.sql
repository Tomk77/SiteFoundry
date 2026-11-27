-- WP2 finding 2.4: content type schemas were never published, so types created in the admin and
-- field changes to existing types never reached REST or GraphQL, and new sites delivered no
-- structured content at all.
--
-- A schema is structure, not content: publishing it needs structured-content edit access, and the
-- admin publishes it on every save. Publishing is a no-op when nothing changed. Seeded types of a new
-- language are published right away, and this migration publishes every type that drifted.

create or replace function private.current_content_type_schema(target_content_type_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'fields', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', field.key,
        'label', field.label,
        'type', field.field_type,
        'required', field.is_required,
        'primary', field.is_primary,
        'options', field.options
      ) order by field.position)
      from public.content_fields field
      where field.content_type_id = target_content_type_id
    ), '[]'::jsonb)
  );
$$;

-- Publishes the current fields when they differ from the published schema. Returns the version.
create or replace function private.sync_content_type_schema(target_content_type_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_type public.content_types%rowtype;
  schema jsonb;
begin
  select * into content_type
  from public.content_types where id = target_content_type_id for update;

  if content_type.id is null then
    raise exception 'Content type not found' using errcode = 'P0002';
  end if;

  schema := private.current_content_type_schema(content_type.id);

  if content_type.published_schema_version > 0 and content_type.published_schema = schema then
    return content_type.published_schema_version;
  end if;

  update public.content_types
  set published_schema = schema,
      published_schema_version = content_type.published_schema_version + 1,
      schema_published_at = now()
  where id = content_type.id;

  return content_type.published_schema_version + 1;
end;
$$;

revoke all on function private.current_content_type_schema(uuid) from public, anon, authenticated;
revoke all on function private.sync_content_type_schema(uuid) from public, anon, authenticated;

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
  from public.content_types where id = target_content_type_id;

  if not private.has_language_access(target_language_id, auth.uid(), 'structured', 'edit') then
    raise exception 'You do not have permission to publish this content type' using errcode = '42501';
  end if;

  return private.sync_content_type_schema(target_content_type_id);
end;
$$;

revoke all on function public.publish_content_type_schema(uuid) from public, anon;
grant execute on function public.publish_content_type_schema(uuid) to authenticated;

-- Runs after seed_structured_content_on_language_created (triggers fire in name order).
create or replace function private.publish_seeded_content_type_schemas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  type_id uuid;
begin
  for type_id in select id from public.content_types where site_language_id = new.id loop
    perform private.sync_content_type_schema(type_id);
  end loop;

  return new;
end;
$$;

revoke all on function private.publish_seeded_content_type_schemas() from public, anon, authenticated;

drop trigger if exists structured_content_publish_seeded_schemas on public.site_languages;
create trigger structured_content_publish_seeded_schemas
after insert on public.site_languages
for each row execute function private.publish_seeded_content_type_schemas();

-- Backfill: publish every schema that was never published or drifted from its fields.
do $backfill$
declare
  type_id uuid;
begin
  for type_id in select id from public.content_types loop
    perform private.sync_content_type_schema(type_id);
  end loop;
end;
$backfill$;
