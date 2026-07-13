create table if not exists public.redirects (
  id uuid primary key default gen_random_uuid(),
  site_language_id uuid not null references public.site_languages(id) on delete cascade,
  page_id uuid references public.pages(id) on delete set null,
  source_path text not null,
  destination_path text not null,
  created_at timestamptz not null default now(),
  check (source_path like '/%' and destination_path like '/%' and source_path <> destination_path),
  unique (site_language_id, source_path)
);

create index if not exists redirects_destination_idx
on public.redirects (site_language_id, destination_path);

create index if not exists redirects_page_id_idx
on public.redirects (page_id);

alter table public.redirects enable row level security;

create policy "Members can read redirects"
on public.redirects for select to authenticated
using (private.is_language_member(site_language_id, (select auth.uid())));

create policy "Editors can create redirects"
on public.redirects for insert to authenticated
with check (private.can_edit_language(site_language_id, (select auth.uid())));

create policy "Editors can update redirects"
on public.redirects for update to authenticated
using (private.can_edit_language(site_language_id, (select auth.uid())))
with check (private.can_edit_language(site_language_id, (select auth.uid())));

create policy "Editors can delete redirects"
on public.redirects for delete to authenticated
using (private.can_edit_language(site_language_id, (select auth.uid())));

create or replace function private.page_path(target_page_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  with recursive ancestors as (
    select id, parent_id, slug, is_homepage, 0 as depth
    from public.pages where id = target_page_id
    union all
    select parent.id, parent.parent_id, parent.slug, parent.is_homepage, child.depth + 1
    from public.pages parent
    join ancestors child on child.parent_id = parent.id
  )
  select coalesce(
    '/' || string_agg(slug, '/' order by depth desc) filter (where not is_homepage),
    '/'
  )
  from ancestors;
$$;

create or replace function public.move_page(
  moving_page_id uuid,
  target_page_id uuid,
  drop_position text,
  create_redirects boolean
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
  old_paths jsonb;
  path_entry record;
  new_path text;
  redirect_count integer := 0;
begin
  if drop_position not in ('before', 'inside', 'after') then raise exception 'Unknown drop position'; end if;
  select * into moving_page from public.pages where id = moving_page_id for update;
  select * into target_page from public.pages where id = target_page_id for update;
  if moving_page.id is null or target_page.id is null then raise exception 'The source or destination page no longer exists'; end if;
  if moving_page.is_homepage then raise exception 'The homepage is fixed to the tree root'; end if;
  if moving_page.site_language_id <> target_page.site_language_id then raise exception 'Pages cannot be moved between language trees'; end if;
  if moving_page.id = target_page.id then raise exception 'A page cannot be dropped onto itself'; end if;
  if not private.can_edit_language(moving_page.site_language_id, auth.uid()) then raise exception 'You do not have permission to move this page'; end if;
  if exists (
    with recursive descendants as (
      select id from public.pages where parent_id = moving_page.id
      union all
      select page.id from public.pages page join descendants on page.parent_id = descendants.id
    ) select 1 from descendants where id = target_page.id
  ) then raise exception 'A page cannot be moved beneath one of its descendants'; end if;

  old_parent_id := moving_page.parent_id;
  if target_page.is_homepage or drop_position = 'inside' then
    new_parent_id := target_page.id;
    drop_position := 'inside';
  else
    new_parent_id := target_page.parent_id;
  end if;
  if new_parent_id is null then raise exception 'Only the homepage may live at the tree root'; end if;
  if new_parent_id <> old_parent_id and exists (
    select 1 from public.pages
    where parent_id = new_parent_id and slug = moving_page.slug and id <> moving_page.id
  ) then raise exception 'A page with this URL slug already exists at the destination'; end if;

  with recursive subtree as (
    select id, status from public.pages where id = moving_page.id
    union all
    select page.id, page.status from public.pages page join subtree on page.parent_id = subtree.id
  )
  select count(*), count(*) filter (where status = 'published'),
    coalesce(jsonb_object_agg(id::text, private.page_path(id)) filter (where status = 'published'), '{}'::jsonb)
  into moved_count, published_count, old_paths
  from subtree;

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

revoke execute on function public.move_page(uuid, uuid, text, boolean) from public;
grant execute on function public.move_page(uuid, uuid, text, boolean) to authenticated;
