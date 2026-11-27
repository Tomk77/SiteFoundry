-- WP2 finding 2.5: renaming and deleting pages and publishing menus bypassed the database
-- functions. Renames now create a concept revision, deletes share one guarded function, and menus
-- are published with the server clock and an explicit publish check.

create or replace function public.rename_page(target_page_id uuid, target_title text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  page public.pages%rowtype;
begin
  select * into page from public.pages where id = target_page_id for update;

  if not private.has_page_access(target_page_id, auth.uid(), 'edit') then
    raise exception 'You do not have permission to rename this page' using errcode = '42501';
  end if;

  if coalesce(trim(target_title), '') = '' then
    raise exception 'A page title is required.' using errcode = '22023';
  end if;

  return private.save_page_revision_unchecked(
    page.id, page.concept_revision_id, trim(target_title), page.slug, page.content_blocks,
    page.seo_title, page.seo_description, page.social_image, page.preferred_child_template,
    page.validation_status, false
  );
end;
$$;

create or replace function public.delete_page(target_page_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  page public.pages%rowtype;
begin
  select * into page from public.pages where id = target_page_id for update;

  if not private.has_page_access(target_page_id, auth.uid(), 'edit') then
    raise exception 'You do not have permission to delete this page' using errcode = '42501';
  end if;

  if page.is_homepage then
    raise exception 'The homepage cannot be deleted.' using errcode = '22023';
  end if;

  if exists (select 1 from public.pages where parent_id = page.id) then
    raise exception 'This page has child pages. Move or delete those pages first.'
      using errcode = '23503';
  end if;

  delete from public.pages where id = page.id;
end;
$$;

create or replace function public.publish_navigation_menu(target_menu_id uuid, target_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  menu public.navigation_menus%rowtype;
begin
  select * into menu from public.navigation_menus where id = target_menu_id for update;

  if menu.id is null or not private.has_language_access(
    menu.site_language_id,
    auth.uid(),
    case when menu.location = 'footer' then 'footer' else 'navigation' end,
    'publish'
  ) then
    raise exception 'You do not have permission to publish this menu' using errcode = '42501';
  end if;

  if jsonb_typeof(target_items) is distinct from 'array' then
    raise exception 'Menu items must be an array' using errcode = '22023';
  end if;

  update public.navigation_menus
  set draft_items = target_items, published_items = target_items, published_at = now()
  where id = menu.id
  returning * into menu;

  return jsonb_build_object('updatedAt', menu.updated_at, 'publishedAt', menu.published_at);
end;
$$;

revoke all on function public.rename_page(uuid, text) from public, anon;
revoke all on function public.delete_page(uuid) from public, anon;
revoke all on function public.publish_navigation_menu(uuid, jsonb) from public, anon;
grant execute on function public.rename_page(uuid, text) to authenticated;
grant execute on function public.delete_page(uuid) to authenticated;
grant execute on function public.publish_navigation_menu(uuid, jsonb) to authenticated;

revoke update (title) on public.pages from authenticated;
drop policy if exists "Editors can delete pages" on public.pages;
revoke delete on public.pages from anon, authenticated;
