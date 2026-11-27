-- Publishing a header or footer menu needs the publish capability (product decision 2026-11-27).
-- Saving draft items still needs only edit access for the menu's section. A trigger is used because
-- an RLS policy cannot compare the old and new published items.

create or replace function private.check_navigation_publish()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- SECURITY DEFINER functions and maintenance run as the table owner and are not API callers.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if (
    tg_op = 'INSERT'
    and (new.published_items <> '[]'::jsonb or new.published_at is not null)
  ) or (
    tg_op = 'UPDATE'
    and (
      new.published_items is distinct from old.published_items
      or new.published_at is distinct from old.published_at
    )
  ) then
    if not private.has_language_access(
      new.site_language_id,
      auth.uid(),
      case when new.location = 'footer' then 'footer' else 'navigation' end,
      'publish'
    ) then
      raise exception 'You do not have permission to publish this menu' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.check_navigation_publish() from public, anon;
grant execute on function private.check_navigation_publish() to authenticated;

drop trigger if exists navigation_menus_check_publish on public.navigation_menus;
create trigger navigation_menus_check_publish
before insert or update on public.navigation_menus
for each row execute function private.check_navigation_publish();
