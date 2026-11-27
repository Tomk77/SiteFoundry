-- WP2 findings 2.2 and 2.3.
--
-- 2.2: delivery computes each page path at read time from the live tree, using every ancestor's
-- published slug (or its live slug when it was never published). Moves therefore take effect
-- immediately, and a slug change takes effect when the page is published. Publishing a slug change
-- records redirects for the page and its published descendants. See ADR 0006.
--
-- 2.3: all automatic redirects go through private.record_redirect, which upserts, collapses chains
-- and removes a redirect whose source has become a live path again.

create or replace function private.published_page_path(target_page_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with recursive ancestors as (
    select page.id, page.parent_id, page.is_homepage,
      coalesce(revision.snapshot ->> 'slug', page.slug) as slug, 0 as depth
    from public.pages page
    left join public.page_published_revisions revision on revision.id = page.published_revision_id
    where page.id = target_page_id
    union all
    select parent.id, parent.parent_id, parent.is_homepage,
      coalesce(revision.snapshot ->> 'slug', parent.slug), child.depth + 1
    from public.pages parent
    join ancestors child on child.parent_id = parent.id
    left join public.page_published_revisions revision on revision.id = parent.published_revision_id
  ) cycle id set is_cycle using visited
  select coalesce(
    '/' || string_agg(slug, '/' order by depth desc) filter (where not is_homepage and not is_cycle),
    '/'
  )
  from ancestors;
$$;

-- Published paths of a page and its published descendants, keyed by page id.
create or replace function private.published_subtree_paths(target_page_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with recursive subtree as (
    select id, status, published_revision_id from public.pages where id = target_page_id
    union all
    select page.id, page.status, page.published_revision_id
    from public.pages page
    join subtree on page.parent_id = subtree.id
  ) cycle id set is_cycle using visited
  select coalesce(
    jsonb_object_agg(id::text, private.published_page_path(id)),
    '{}'::jsonb
  )
  from subtree
  where not is_cycle and status = 'published' and published_revision_id is not null;
$$;

create or replace function private.record_redirect(
  target_language_id uuid,
  target_page_id uuid,
  source text,
  destination text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if source = destination then
    return false;
  end if;

  -- The destination is a live path now; nothing may redirect away from it.
  delete from public.redirects
  where site_language_id = target_language_id and source_path = destination;

  -- Collapse chains: anything that pointed at the old path now points at the new one.
  update public.redirects
  set destination_path = destination
  where site_language_id = target_language_id and destination_path = source;

  insert into public.redirects (site_language_id, page_id, source_path, destination_path)
  values (target_language_id, target_page_id, source, destination)
  on conflict (site_language_id, source_path)
  do update set destination_path = excluded.destination_path, page_id = excluded.page_id;

  return true;
end;
$$;

-- Records a redirect for every page in `old_paths` whose published path changed.
create or replace function private.record_path_changes(target_language_id uuid, old_paths jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry record;
  recorded integer := 0;
begin
  for entry in select key, value from jsonb_each_text(coalesce(old_paths, '{}'::jsonb)) loop
    if private.record_redirect(
      target_language_id,
      entry.key::uuid,
      entry.value,
      private.published_page_path(entry.key::uuid)
    ) then
      recorded := recorded + 1;
    end if;
  end loop;

  return recorded;
end;
$$;

revoke all on function private.published_page_path(uuid) from public, anon, authenticated;
revoke all on function private.published_subtree_paths(uuid) from public, anon, authenticated;
revoke all on function private.record_redirect(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function private.record_path_changes(uuid, jsonb) from public, anon, authenticated;

-------------------------------------------------------------------------------------------------
-- Delivery: live paths
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
        'parentId', page.parent_id,
        'path', private.published_page_path(page.id),
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

-------------------------------------------------------------------------------------------------
-- Publishing records redirects when the published path changes
-------------------------------------------------------------------------------------------------

create or replace function public.save_page_revision(
  target_page_id uuid,
  expected_concept_revision_id uuid,
  target_title text,
  target_slug text,
  target_content_blocks jsonb,
  target_seo_title text,
  target_seo_description text,
  target_social_image text,
  target_preferred_child_template text,
  target_validation_status text,
  should_publish boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  language_id uuid;
  old_paths jsonb;
  result jsonb;
begin
  select site_language_id into language_id from public.pages where id = target_page_id for update;

  if not private.has_page_access(target_page_id, auth.uid(), 'edit') then
    raise exception 'You do not have permission to save this page' using errcode = '42501';
  end if;

  if should_publish and not private.can_publish_page(target_page_id, auth.uid()) then
    raise exception 'You do not have permission to publish this page' using errcode = '42501';
  end if;

  if should_publish then
    perform private.lock_page_tree(language_id);
    old_paths := private.published_subtree_paths(target_page_id);
  end if;

  result := private.save_page_revision_unchecked(
    target_page_id, expected_concept_revision_id, target_title, target_slug, target_content_blocks,
    target_seo_title, target_seo_description, target_social_image, target_preferred_child_template,
    target_validation_status, should_publish
  );

  if should_publish then
    perform private.record_path_changes(language_id, old_paths);
  end if;

  return result;
end;
$$;

create or replace function public.publish_page(target_page_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  language_id uuid;
  old_paths jsonb;
  revision_id uuid;
begin
  select site_language_id into language_id from public.pages where id = target_page_id for update;

  if not private.can_publish_page(target_page_id, auth.uid()) then
    raise exception 'You do not have permission to publish this page' using errcode = '42501';
  end if;

  perform private.lock_page_tree(language_id);
  old_paths := private.published_subtree_paths(target_page_id);
  revision_id := private.publish_page_unchecked(target_page_id);
  perform private.record_path_changes(language_id, old_paths);

  return revision_id;
end;
$$;

-------------------------------------------------------------------------------------------------
-- move_page: published paths and the shared redirect helper
-------------------------------------------------------------------------------------------------

create or replace function public.move_page(
  moving_page_id uuid,
  target_page_id uuid,
  drop_position text,
  create_redirects boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  moving_page public.pages%rowtype;
  target_page public.pages%rowtype;
  tree_language_id uuid;
  old_parent_id uuid;
  new_parent_id uuid;
  target_order integer;
  moved_count integer;
  published_count integer;
  parent_title text;
  old_paths jsonb;
  redirect_count integer := 0;
begin
  if drop_position not in ('before', 'inside', 'after') then raise exception 'Unknown drop position'; end if;

  select site_language_id into tree_language_id from public.pages where id = moving_page_id;
  if tree_language_id is not null then perform private.lock_page_tree(tree_language_id); end if;

  select * into moving_page from public.pages where id = moving_page_id for update;
  select * into target_page from public.pages where id = target_page_id for update;
  if moving_page.id is null or target_page.id is null then raise exception 'The source or destination page no longer exists'; end if;
  if moving_page.is_homepage then raise exception 'The homepage is fixed to the tree root'; end if;
  if moving_page.site_language_id <> target_page.site_language_id then raise exception 'Pages cannot be moved between language trees'; end if;
  if moving_page.id = target_page.id then raise exception 'A page cannot be dropped onto itself'; end if;

  old_parent_id := moving_page.parent_id;
  if target_page.is_homepage or drop_position = 'inside' then
    new_parent_id := target_page.id;
    drop_position := 'inside';
  else
    new_parent_id := target_page.parent_id;
  end if;
  if new_parent_id is null then raise exception 'Only the homepage may live at the tree root'; end if;

  if not private.has_page_access(moving_page.id, auth.uid(), 'edit')
    or not private.has_page_access(new_parent_id, auth.uid(), 'edit') then
    raise exception 'You do not have permission to move this page' using errcode = '42501';
  end if;

  if exists (
    with recursive descendants as (
      select id from public.pages where parent_id = moving_page.id
      union all
      select page.id from public.pages page join descendants on page.parent_id = descendants.id
    ) cycle id set is_cycle using visited
    select 1 from descendants where id = target_page.id
  ) then raise exception 'A page cannot be moved beneath one of its descendants'; end if;

  if new_parent_id <> old_parent_id and exists (
    select 1 from public.pages
    where parent_id = new_parent_id and slug = moving_page.slug and id <> moving_page.id
  ) then raise exception 'A page with this URL slug already exists at the destination'; end if;

  with recursive subtree as (
    select id, status from public.pages where id = moving_page.id
    union all
    select page.id, page.status from public.pages page join subtree on page.parent_id = subtree.id
  ) cycle id set is_cycle using visited
  select count(*), count(*) filter (where status = 'published'),
    coalesce(jsonb_object_agg(id::text, private.published_page_path(id)) filter (where status = 'published'), '{}'::jsonb)
  into moved_count, published_count, old_paths
  from subtree
  where not is_cycle;

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
    redirect_count := private.record_path_changes(moving_page.site_language_id, old_paths);
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

revoke all on function public.move_page(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.move_page(uuid, uuid, text, boolean) to authenticated;
