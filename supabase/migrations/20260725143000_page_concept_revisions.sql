create table if not exists public.page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  site_language_id uuid not null references public.site_languages(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (page_id, version)
);

alter table public.pages
add column if not exists concept_revision_id uuid;

alter table public.page_published_revisions
add column if not exists source_concept_revision_id uuid;

create or replace function private.page_snapshot(page public.pages)
returns jsonb
language sql
stable
set search_path = public, private
as $$
  select jsonb_build_object(
    'id', page.id,
    'parentId', page.parent_id,
    'languageId', page.site_language_id,
    'title', page.title,
    'slug', page.slug,
    'path', private.page_path(page.id),
    'templateName', page.template_name,
    'templateKey', page.created_from_template_key,
    'validationStatus', page.validation_status,
    'blocks', coalesce((
      select jsonb_agg(
        case when block.value ? 'version'
          then block.value
          else block.value || jsonb_build_object('version', 1)
        end
        order by block.ordinality
      )
      from jsonb_array_elements(page.content_blocks) with ordinality block(value, ordinality)
    ), '[]'::jsonb),
    'seo', jsonb_build_object(
      'title', page.seo_title,
      'description', page.seo_description,
      'socialImage', page.social_image
    ),
    'preferredChildTemplate', page.preferred_child_template,
    'createdAt', page.created_at,
    'updatedAt', page.updated_at
  );
$$;

create index if not exists page_revisions_page_idx
on public.page_revisions (page_id, version desc);

alter table public.page_revisions enable row level security;

drop policy if exists "Members can read page revisions" on public.page_revisions;
create policy "Members can read page revisions"
on public.page_revisions for select to authenticated
using (private.is_language_member(site_language_id, (select auth.uid())));

with inserted as (
  insert into public.page_revisions (
    page_id,
    site_language_id,
    version,
    snapshot,
    created_at
  )
  select
    page.id,
    page.site_language_id,
    1,
    private.page_snapshot(page),
    page.updated_at
  from public.pages page
  where page.concept_revision_id is null
  on conflict (page_id, version) do update
  set snapshot = excluded.snapshot
  returning id, page_id
)
update public.pages page
set concept_revision_id = inserted.id
from inserted
where page.id = inserted.page_id
  and page.concept_revision_id is null;

update public.page_published_revisions published
set source_concept_revision_id = page.concept_revision_id
from public.pages page, public.page_revisions concept
where published.id = page.published_revision_id
  and concept.id = page.concept_revision_id
  and published.source_concept_revision_id is null
  and (published.snapshot - 'updatedAt') = (concept.snapshot - 'updatedAt');

alter table public.pages
drop constraint if exists pages_concept_revision_id_fkey;

alter table public.pages
add constraint pages_concept_revision_id_fkey
foreign key (concept_revision_id)
references public.page_revisions(id)
on delete set null
deferrable initially deferred;

alter table public.page_published_revisions
drop constraint if exists page_published_revisions_source_concept_revision_id_fkey;

alter table public.page_published_revisions
add constraint page_published_revisions_source_concept_revision_id_fkey
foreign key (source_concept_revision_id)
references public.page_revisions(id)
on delete set null;

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
set search_path = public, private
as $$
declare
  page public.pages%rowtype;
  new_concept_revision_id uuid := gen_random_uuid();
  concept_version integer;
  current_published_revision_id uuid;
  current_published_version integer;
  current_published_at timestamptz;
begin
  select * into page
  from public.pages
  where id = target_page_id
  for update;

  if page.id is null then
    raise exception 'Page not found';
  end if;

  if not private.can_edit_language(page.site_language_id, auth.uid()) then
    raise exception 'You do not have permission to save this page';
  end if;

  if page.concept_revision_id is distinct from expected_concept_revision_id then
    raise exception using
      errcode = '40001',
      message = 'This page has a newer concept revision. Reload before saving again.';
  end if;

  if jsonb_typeof(target_content_blocks) is distinct from 'array' then
    raise exception 'Page content blocks must be an array';
  end if;

  if target_validation_status not in ('ready', 'needs_attention') then
    raise exception 'Invalid page validation status';
  end if;

  select coalesce(max(version), 0) + 1
  into concept_version
  from public.page_revisions
  where page_id = page.id;

  update public.pages
  set
    title = trim(target_title),
    slug = target_slug,
    content_blocks = target_content_blocks,
    seo_title = target_seo_title,
    seo_description = target_seo_description,
    social_image = target_social_image,
    preferred_child_template = target_preferred_child_template,
    validation_status = target_validation_status,
    status = case when page.published_revision_id is null then 'concept' else 'published' end,
    concept_revision_id = new_concept_revision_id
  where id = page.id
  returning * into page;

  insert into public.page_revisions (
    id,
    page_id,
    site_language_id,
    version,
    snapshot
  ) values (
    new_concept_revision_id,
    page.id,
    page.site_language_id,
    concept_version,
    private.page_snapshot(page)
  );

  if should_publish then
    select coalesce(max(version), 0) + 1
    into current_published_version
    from public.page_published_revisions
    where page_id = page.id;

    insert into public.page_published_revisions (
      page_id,
      site_language_id,
      version,
      snapshot,
      source_concept_revision_id
    ) values (
      page.id,
      page.site_language_id,
      current_published_version,
      private.page_snapshot(page),
      new_concept_revision_id
    )
    returning id, page_published_revisions.published_at
    into current_published_revision_id, current_published_at;

    update public.pages
    set
      status = 'published',
      published_revision_id = current_published_revision_id
    where id = page.id
    returning * into page;
  else
    select revision.id, revision.version, revision.published_at
    into current_published_revision_id, current_published_version, current_published_at
    from public.page_published_revisions revision
    where revision.id = page.published_revision_id;
  end if;

  return jsonb_build_object(
    'updatedAt', page.updated_at,
    'status', page.status,
    'validationStatus', page.validation_status,
    'conceptRevisionId', new_concept_revision_id,
    'conceptRevisionVersion', concept_version,
    'publishedRevisionId', current_published_revision_id,
    'publishedRevisionVersion', current_published_version,
    'publishedAt', current_published_at,
    'hasUnpublishedChanges', not should_publish and current_published_revision_id is not null
  );
end;
$$;

create or replace function public.publish_page(target_page_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  page public.pages%rowtype;
  next_version integer;
  revision_id uuid;
begin
  select * into page
  from public.pages
  where id = target_page_id
  for update;

  if page.id is null then
    raise exception 'Page not found';
  end if;

  if not private.can_edit_language(page.site_language_id, auth.uid()) then
    raise exception 'You do not have permission to publish this page';
  end if;

  if page.concept_revision_id is null then
    raise exception 'Save a concept revision before publishing this page';
  end if;

  select coalesce(max(version), 0) + 1
  into next_version
  from public.page_published_revisions
  where page_id = page.id;

  insert into public.page_published_revisions (
    page_id,
    site_language_id,
    version,
    snapshot,
    source_concept_revision_id
  ) values (
    page.id,
    page.site_language_id,
    next_version,
    private.page_snapshot(page),
    page.concept_revision_id
  )
  returning id into revision_id;

  update public.pages
  set
    status = 'published',
    published_revision_id = revision_id
  where id = page.id;

  return revision_id;
end;
$$;

create or replace function public.discard_page_concept(target_page_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  page public.pages%rowtype;
  published public.page_published_revisions%rowtype;
  restored_concept_id uuid;
  restored_version integer;
begin
  select * into page
  from public.pages
  where id = target_page_id
  for update;

  if page.id is null then
    raise exception 'Page not found';
  end if;

  if not private.can_edit_language(page.site_language_id, auth.uid()) then
    raise exception 'You do not have permission to discard this concept';
  end if;

  select * into published
  from public.page_published_revisions
  where id = page.published_revision_id;

  if published.id is null then
    raise exception 'This page does not have a published version';
  end if;

  restored_concept_id := published.source_concept_revision_id;

  if restored_concept_id is null then
    restored_concept_id := gen_random_uuid();

    select coalesce(max(version), 0) + 1
    into restored_version
    from public.page_revisions
    where page_id = page.id;

    insert into public.page_revisions (
      id,
      page_id,
      site_language_id,
      version,
      snapshot
    ) values (
      restored_concept_id,
      page.id,
      page.site_language_id,
      restored_version,
      published.snapshot
    );

    update public.page_published_revisions
    set source_concept_revision_id = restored_concept_id
    where id = published.id;
  end if;

  update public.pages
  set
    title = published.snapshot ->> 'title',
    slug = published.snapshot ->> 'slug',
    template_name = published.snapshot ->> 'templateName',
    created_from_template_key = published.snapshot ->> 'templateKey',
    content_blocks = coalesce(published.snapshot -> 'blocks', '[]'::jsonb),
    seo_title = coalesce(published.snapshot #>> '{seo,title}', ''),
    seo_description = coalesce(published.snapshot #>> '{seo,description}', ''),
    social_image = published.snapshot #>> '{seo,socialImage}',
    preferred_child_template = published.snapshot ->> 'preferredChildTemplate',
    validation_status = coalesce(published.snapshot ->> 'validationStatus', 'ready'),
    status = 'published',
    concept_revision_id = restored_concept_id
  where id = page.id;

  return restored_concept_id;
end;
$$;

revoke all on function public.save_page_revision(
  uuid, uuid, text, text, jsonb, text, text, text, text, text, boolean
) from public, anon;
grant execute on function public.save_page_revision(
  uuid, uuid, text, text, jsonb, text, text, text, text, text, boolean
) to authenticated;

revoke all on function public.publish_page(uuid) from public, anon;
grant execute on function public.publish_page(uuid) to authenticated;

revoke all on function public.discard_page_concept(uuid) from public, anon;
grant execute on function public.discard_page_concept(uuid) to authenticated;
