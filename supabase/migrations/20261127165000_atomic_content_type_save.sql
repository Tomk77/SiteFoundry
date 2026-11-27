-- Review of WP2 2.4 (PR #5): the admin saved a content type and then published its schema in two
-- separate calls, so a failed publish left the edit saved while the UI reported failure. Saving now
-- publishes in the same transaction.
--
-- The original body moves to private.save_content_type_fields unchanged. It stays SECURITY INVOKER,
-- so row level security still decides what the caller may write.

do $move$
begin
  if to_regprocedure('private.save_content_type_fields(uuid, uuid, text, text, text, text, text, jsonb)') is null then
    alter function public.save_content_type(uuid, uuid, text, text, text, text, text, jsonb) set schema private;
    alter function private.save_content_type(uuid, uuid, text, text, text, text, text, jsonb)
      rename to save_content_type_fields;
  end if;
end;
$move$;

revoke all on function private.save_content_type_fields(uuid, uuid, text, text, text, text, text, jsonb) from public, anon;
grant execute on function private.save_content_type_fields(uuid, uuid, text, text, text, text, text, jsonb) to authenticated;

create or replace function public.save_content_type(
  target_language_id uuid,
  target_type_id uuid,
  target_slug text,
  target_name text,
  target_singular_name text,
  target_icon text,
  target_description text,
  target_fields jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_type_id uuid;
begin
  saved_type_id := private.save_content_type_fields(
    target_language_id, target_type_id, target_slug, target_name, target_singular_name,
    target_icon, target_description, target_fields
  );
  perform public.publish_content_type_schema(saved_type_id);

  return saved_type_id;
end;
$$;

revoke all on function public.save_content_type(uuid, uuid, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.save_content_type(uuid, uuid, text, text, text, text, text, jsonb) to authenticated;
