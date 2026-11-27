-- Review of WP2 2.2 (PR #4): delivery serves a page at its published slug until a slug change is
-- published, but the sibling-slug unique index only covers the live slug. A concept slug change
-- therefore freed the old slug, and a second page could be published at the same URL.
--
-- A sibling slug is now taken when it is any sibling's live slug or published slug. Checked on
-- insert, slug and parent changes, and on publish, under the per-language tree lock.

create or replace function private.published_slug(target_revision_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select snapshot ->> 'slug' from public.page_published_revisions where id = target_revision_id;
$$;

create or replace function private.check_sibling_slugs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  own_slugs text[];
begin
  if new.parent_id is null then
    return new;
  end if;

  perform private.lock_page_tree(new.site_language_id);
  own_slugs := array_remove(array[new.slug, private.published_slug(new.published_revision_id)], null);

  if exists (
    select 1
    from public.pages sibling
    where sibling.parent_id = new.parent_id
      and sibling.id <> new.id
      and (
        sibling.slug = any(own_slugs)
        or private.published_slug(sibling.published_revision_id) = any(own_slugs)
      )
  ) then
    raise exception 'A page with this URL slug already exists at this level.' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function private.published_slug(uuid) from public, anon, authenticated;
revoke all on function private.check_sibling_slugs() from public, anon, authenticated;

drop trigger if exists pages_check_sibling_slugs on public.pages;
create trigger pages_check_sibling_slugs
before insert or update of slug, parent_id, published_revision_id on public.pages
for each row execute function private.check_sibling_slugs();
