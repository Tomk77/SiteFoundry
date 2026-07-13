create or replace function public.move_page(
  moving_page_id uuid,
  target_page_id uuid,
  drop_position text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  moving_page public.pages%rowtype;
  target_page public.pages%rowtype;
  old_parent_id uuid;
  new_parent_id uuid;
  target_order integer;
  moved_count integer;
  published_count integer;
  parent_title text;
begin
  if drop_position not in ('before', 'inside', 'after') then
    raise exception 'Unknown drop position';
  end if;

  select * into moving_page from public.pages where id = moving_page_id for update;
  select * into target_page from public.pages where id = target_page_id for update;
  if moving_page.id is null or target_page.id is null then
    raise exception 'The source or destination page no longer exists';
  end if;
  if moving_page.is_homepage then
    raise exception 'The homepage is fixed to the tree root';
  end if;
  if moving_page.site_language_id <> target_page.site_language_id then
    raise exception 'Pages cannot be moved between language trees';
  end if;
  if moving_page.id = target_page.id then
    raise exception 'A page cannot be dropped onto itself';
  end if;
  if not private.can_edit_language(moving_page.site_language_id, auth.uid()) then
    raise exception 'You do not have permission to move this page';
  end if;
  if exists (
    with recursive descendants as (
      select id from public.pages where parent_id = moving_page.id
      union all
      select page.id
      from public.pages page
      join descendants on page.parent_id = descendants.id
    )
    select 1 from descendants where id = target_page.id
  ) then
    raise exception 'A page cannot be moved beneath one of its descendants';
  end if;

  old_parent_id := moving_page.parent_id;
  if target_page.is_homepage or drop_position = 'inside' then
    new_parent_id := target_page.id;
    drop_position := 'inside';
  else
    new_parent_id := target_page.parent_id;
  end if;

  if new_parent_id is null then
    raise exception 'Only the homepage may live at the tree root';
  end if;
  if new_parent_id <> old_parent_id and exists (
    select 1 from public.pages
    where parent_id = new_parent_id
      and slug = moving_page.slug
      and id <> moving_page.id
  ) then
    raise exception 'A page with this URL slug already exists at the destination';
  end if;

  with ordered as (
    select id, row_number() over (order by position, title, id) * 10 as next_position
    from public.pages
    where parent_id = new_parent_id and id <> moving_page.id
  )
  update public.pages page
  set position = ordered.next_position
  from ordered
  where page.id = ordered.id;

  if drop_position = 'inside' then
    select coalesce(max(position), 0) + 10 into target_order
    from public.pages where parent_id = new_parent_id and id <> moving_page.id;
  else
    select position into target_order from public.pages where id = target_page.id;
    if drop_position = 'before' then
      target_order := target_order - 5;
    else
      target_order := target_order + 5;
    end if;
  end if;

  update public.pages
  set parent_id = new_parent_id, position = target_order
  where id = moving_page.id;

  with affected_parents(parent_id) as (
    select old_parent_id union select new_parent_id
  ), ordered as (
    select page.id,
      row_number() over (
        partition by page.parent_id order by page.position, page.title, page.id
      ) - 1 as next_position
    from public.pages page
    join affected_parents on affected_parents.parent_id = page.parent_id
  )
  update public.pages page
  set position = ordered.next_position
  from ordered
  where page.id = ordered.id;

  with recursive subtree as (
    select id, status from public.pages where id = moving_page.id
    union all
    select page.id, page.status
    from public.pages page join subtree on page.parent_id = subtree.id
  )
  select count(*), count(*) filter (where status = 'published')
  into moved_count, published_count from subtree;

  select title into parent_title from public.pages where id = new_parent_id;
  return jsonb_build_object(
    'reparented', old_parent_id <> new_parent_id,
    'parentTitle', parent_title,
    'affectedPages', moved_count,
    'publishedPages', published_count
  );
end;
$$;

revoke execute on function public.move_page(uuid, uuid, text) from public;
grant execute on function public.move_page(uuid, uuid, text) to authenticated;
