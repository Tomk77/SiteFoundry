create table if not exists public.page_templates (
  id uuid primary key default gen_random_uuid(),
  site_language_id uuid not null references public.site_languages(id) on delete cascade,
  key text not null,
  name text not null,
  description text not null default '',
  icon text not null default 'ph-file',
  status text not null default 'draft' check (status in ('draft', 'published')),
  is_fallback boolean not null default false,
  defaults jsonb not null default '{"seoTitle":"","seoDescription":""}'::jsonb,
  preview_path text not null default '',
  components jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint page_templates_key_format check (key ~ '^[a-z][a-z0-9-]*$'),
  constraint page_templates_components_array check (jsonb_typeof(components) = 'array'),
  constraint page_templates_defaults_object check (jsonb_typeof(defaults) = 'object'),
  unique (site_language_id, key)
);

create unique index if not exists page_templates_one_fallback_per_language_idx
on public.page_templates (site_language_id)
where is_fallback;

create index if not exists page_templates_language_status_idx
on public.page_templates (site_language_id, status, name);

create table if not exists public.page_template_revisions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.page_templates(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  note text not null default 'Template saved',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create index if not exists page_template_revisions_template_idx
on public.page_template_revisions (template_id, version desc);

alter table public.pages
  add column if not exists created_from_template_id uuid
  references public.page_templates(id) on delete set null;

create index if not exists pages_created_from_template_id_idx
on public.pages (created_from_template_id);

alter table public.page_templates enable row level security;
alter table public.page_template_revisions enable row level security;

drop policy if exists "Members can read page templates" on public.page_templates;
create policy "Members can read page templates"
on public.page_templates for select to authenticated
using (private.is_language_member(site_language_id, (select auth.uid())));

drop policy if exists "Editors can create page templates" on public.page_templates;
create policy "Editors can create page templates"
on public.page_templates for insert to authenticated
with check (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Editors can update page templates" on public.page_templates;
create policy "Editors can update page templates"
on public.page_templates for update to authenticated
using (private.can_edit_language(site_language_id, (select auth.uid())))
with check (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Editors can delete page templates" on public.page_templates;
create policy "Editors can delete page templates"
on public.page_templates for delete to authenticated
using (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Members can read page template revisions" on public.page_template_revisions;
create policy "Members can read page template revisions"
on public.page_template_revisions for select to authenticated
using (
  exists (
    select 1
    from public.page_templates template
    where template.id = page_template_revisions.template_id
      and private.is_language_member(template.site_language_id, (select auth.uid()))
  )
);

insert into public.page_templates (
  site_language_id,
  key,
  name,
  description,
  icon,
  status,
  is_fallback,
  defaults,
  preview_path,
  components,
  created_at,
  updated_at
)
select
  language.id,
  seed.key,
  seed.name,
  seed.description,
  seed.icon,
  seed.status,
  seed.is_fallback,
  seed.defaults,
  seed.preview_path,
  seed.components,
  seed.created_at,
  seed.created_at
from public.site_languages language
cross join (
  values
    (
      'standard-page',
      'Standard page',
      'A blank page with the site''s default structure.',
      'ph-file',
      'published',
      true,
      '{"seoTitle":"","seoDescription":""}'::jsonb,
      '/preview/standard',
      '[{"type":"hero","values":{"eyebrow":"","headline":"Page title","subheadline":"A short introduction to the page.","align":"Left","media":"","fullBleed":false}},{"type":"richtext","values":{"body":"Start writing your page content here. This paragraph is placeholder copy so the layout is easy to judge."}}]'::jsonb,
      '2026-03-03T09:00:00.000Z'::timestamptz
    ),
    (
      'news-article',
      'News article',
      'Headline, date, hero and body for a news post.',
      'ph-newspaper',
      'published',
      false,
      '{"seoTitle":"","seoDescription":"Read the latest from Scaffold CMS."}'::jsonb,
      '/preview/news',
      '[{"type":"hero","values":{"eyebrow":"Product news","headline":"Introducing Scaffold CMS 1.0","subheadline":"The website-native, headless CMS is now generally available.","align":"Left","media":"news-hero.jpg","fullBleed":true}},{"type":"richtext","values":{"body":"Today we''re making Scaffold CMS generally available.\n\nIt rethinks the headless CMS around a canonical page tree."}},{"type":"quote","values":{"text":"Finally, a CMS our editors actually understand.","cite":"Early-access customer","variant":"Bar"}},{"type":"image","values":{"media":"news-hero.jpg","alt":"The page tree in the Scaffold CMS admin","caption":"The page tree is how editors navigate a site.","width":"Wide"}},{"type":"cta","values":{"heading":"Ready to build?","body":"Self-host in minutes.","buttonLabel":"Get started","buttonHref":"/contact","style":"Primary","newTab":false}}]'::jsonb,
      '2026-02-01T09:00:00.000Z'::timestamptz
    ),
    (
      'blog-article',
      'Blog article',
      'Long-form editorial with author and body.',
      'ph-article',
      'published',
      false,
      '{"seoTitle":"","seoDescription":""}'::jsonb,
      '/preview/blog',
      '[{"type":"hero","values":{"eyebrow":"","headline":"A blog headline goes here","subheadline":"Optional standfirst.","align":"Left","media":"","fullBleed":false}},{"type":"richtext","values":{"body":"Body copy for the article."}},{"type":"cta","values":{"heading":"Subscribe","body":"","buttonLabel":"Join","buttonHref":"/newsletter","style":"Secondary","newTab":false}}]'::jsonb,
      '2026-04-04T09:00:00.000Z'::timestamptz
    ),
    (
      'faq-page',
      'FAQ page',
      'Intro plus grouped question-and-answer content.',
      'ph-question',
      'published',
      false,
      '{"seoTitle":"","seoDescription":""}'::jsonb,
      '/preview/faq',
      '[{"type":"hero","values":{"eyebrow":"","headline":"Frequently asked questions","subheadline":"","align":"Center","media":"","fullBleed":false}},{"type":"richtext","values":{"body":"Grouped question-and-answer content lives here."}}]'::jsonb,
      '2026-05-02T09:00:00.000Z'::timestamptz
    ),
    (
      'landing-page',
      'Landing page',
      'Marketing page with hero, proof and CTA.',
      'ph-flag-banner',
      'draft',
      false,
      '{"seoTitle":"","seoDescription":""}'::jsonb,
      '/preview/landing',
      '[{"type":"hero","values":{"eyebrow":"Campaign","headline":"","subheadline":"This hero is missing its headline.","align":"Center","media":"","fullBleed":true}},{"type":"spotlight","values":{"legacy":"Imported from the old theme"}},{"type":"cta","values":{"heading":"Start your trial","body":"","buttonLabel":"Try free","buttonHref":"get-started","style":"Primary","newTab":true}}]'::jsonb,
      '2026-07-10T09:00:00.000Z'::timestamptz
    )
) as seed(
  key,
  name,
  description,
  icon,
  status,
  is_fallback,
  defaults,
  preview_path,
  components,
  created_at
)
on conflict (site_language_id, key) do nothing;

insert into public.page_template_revisions (
  template_id,
  version,
  snapshot,
  note,
  created_at
)
select
  template.id,
  1,
  jsonb_build_object(
    'key', template.key,
    'name', template.name,
    'description', template.description,
    'icon', template.icon,
    'status', template.status,
    'fallback', template.is_fallback,
    'defaults', template.defaults,
    'preview', template.preview_path,
    'components', template.components
  ),
  case when template.key = 'landing-page' then 'Imported from legacy theme' else 'Created' end,
  template.created_at
from public.page_templates template
where not exists (
  select 1
  from public.page_template_revisions revision
  where revision.template_id = template.id
);

update public.pages page
set created_from_template_id = template.id
from public.page_templates template
where page.created_from_template_id is null
  and template.site_language_id = page.site_language_id
  and template.key = page.created_from_template_key;

create or replace function private.record_page_template_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_version integer;
begin
  select coalesce(max(revision.version), 0) + 1
  into next_version
  from public.page_template_revisions revision
  where revision.template_id = new.id;

  insert into public.page_template_revisions (
    template_id,
    version,
    snapshot,
    note,
    created_by
  )
  values (
    new.id,
    next_version,
    jsonb_build_object(
      'key', new.key,
      'name', new.name,
      'description', new.description,
      'icon', new.icon,
      'status', new.status,
      'fallback', new.is_fallback,
      'defaults', new.defaults,
      'preview', new.preview_path,
      'components', new.components
    ),
    case when tg_op = 'INSERT' then 'Created' else 'Template saved' end,
    new.updated_by
  );
  return new;
end;
$$;

drop trigger if exists page_templates_record_revision on public.page_templates;
create trigger page_templates_record_revision
after insert or update on public.page_templates
for each row execute function private.record_page_template_revision();

create or replace function public.get_page_template_workspace(target_language_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.is_language_member(target_language_id, auth.uid()) then
    raise exception 'You do not have access to this language.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'pageCount', (
      select count(*)
      from public.pages page
      where page.site_language_id = target_language_id
    ),
    'templates', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', template.id,
        'siteLanguageId', template.site_language_id,
        'key', template.key,
        'name', template.name,
        'description', template.description,
        'icon', template.icon,
        'status', template.status,
        'fallback', template.is_fallback,
        'defaults', template.defaults,
        'preview', template.preview_path,
        'components', template.components,
        'usageCount', (
          select count(*)
          from public.pages page
          where page.site_language_id = template.site_language_id
            and (
              page.created_from_template_id = template.id
              or (
                page.created_from_template_id is null
                and page.created_from_template_key = template.key
              )
            )
        ),
        'modifiedAt', template.updated_at,
        'revisions', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'version', revision.version,
              'note', revision.note,
              'at', revision.created_at
            ) order by revision.version desc
          )
          from public.page_template_revisions revision
          where revision.template_id = template.id
        ), '[]'::jsonb)
      ) order by template.name
    ), '[]'::jsonb)
  )
  into result
  from public.page_templates template
  where template.site_language_id = target_language_id;

  return result;
end;
$$;

create or replace function public.save_page_template(
  target_language_id uuid,
  target_template_id uuid,
  target_key text,
  target_name text,
  target_description text,
  target_icon text,
  target_status text,
  target_is_fallback boolean,
  target_defaults jsonb,
  target_preview_path text,
  target_components jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.page_templates%rowtype;
  saved_id uuid;
  old_key text;
begin
  if not private.can_edit_language(target_language_id, auth.uid()) then
    raise exception 'You do not have permission to edit templates.' using errcode = '42501';
  end if;
  if coalesce(trim(target_name), '') = '' then
    raise exception 'A template name is required.';
  end if;
  if target_key !~ '^[a-z][a-z0-9-]*$' then
    raise exception 'The stable key is invalid.';
  end if;
  if target_status not in ('draft', 'published') then
    raise exception 'The template status is invalid.';
  end if;
  if jsonb_typeof(target_defaults) <> 'object' or jsonb_typeof(target_components) <> 'array' then
    raise exception 'The template definition is invalid.';
  end if;
  if target_is_fallback and target_status <> 'published' then
    raise exception 'The fallback template must be published.';
  end if;

  if target_template_id is not null then
    select * into existing
    from public.page_templates template
    where template.id = target_template_id
      and template.site_language_id = target_language_id
    for update;
    if not found then raise exception 'Template not found.'; end if;
    if existing.is_fallback and not target_is_fallback then
      raise exception 'Every language needs a fallback. Set another template as fallback first.';
    end if;
    old_key := existing.key;
  end if;

  if target_is_fallback then
    update public.page_templates
    set is_fallback = false,
        updated_by = auth.uid(),
        updated_at = now()
    where site_language_id = target_language_id
      and is_fallback
      and id is distinct from target_template_id;
  end if;

  if target_template_id is null then
    insert into public.page_templates (
      site_language_id,
      key,
      name,
      description,
      icon,
      status,
      is_fallback,
      defaults,
      preview_path,
      components,
      created_by,
      updated_by
    )
    values (
      target_language_id,
      target_key,
      trim(target_name),
      trim(coalesce(target_description, '')),
      coalesce(nullif(target_icon, ''), 'ph-file'),
      target_status,
      target_is_fallback,
      target_defaults,
      coalesce(target_preview_path, ''),
      target_components,
      auth.uid(),
      auth.uid()
    )
    returning id into saved_id;
  else
    update public.page_templates
    set key = target_key,
        name = trim(target_name),
        description = trim(coalesce(target_description, '')),
        icon = coalesce(nullif(target_icon, ''), 'ph-file'),
        status = target_status,
        is_fallback = target_is_fallback,
        defaults = target_defaults,
        preview_path = coalesce(target_preview_path, ''),
        components = target_components,
        updated_by = auth.uid(),
        updated_at = now()
    where id = target_template_id
      and site_language_id = target_language_id
    returning id into saved_id;

    if old_key <> target_key then
      update public.pages
      set preferred_child_template = target_key
      where site_language_id = target_language_id
        and preferred_child_template = old_key;
    end if;
  end if;

  return saved_id;
exception
  when unique_violation then
    raise exception 'A template with this stable key already exists.';
end;
$$;

create or replace function public.set_fallback_page_template(
  target_language_id uuid,
  target_template_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen public.page_templates%rowtype;
begin
  if not private.can_edit_language(target_language_id, auth.uid()) then
    raise exception 'You do not have permission to edit templates.' using errcode = '42501';
  end if;

  select * into chosen
  from public.page_templates template
  where template.id = target_template_id
    and template.site_language_id = target_language_id
  for update;
  if not found then raise exception 'Template not found.'; end if;
  if chosen.status <> 'published' then
    raise exception 'Publish this template before making it the fallback.';
  end if;

  update public.page_templates
  set is_fallback = false,
      updated_by = auth.uid(),
      updated_at = now()
  where site_language_id = target_language_id
    and is_fallback
    and id <> target_template_id;

  update public.page_templates
  set is_fallback = true,
      updated_by = auth.uid(),
      updated_at = now()
  where id = target_template_id;
end;
$$;

create or replace function public.delete_page_template(
  target_language_id uuid,
  target_template_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.page_templates%rowtype;
begin
  if not private.can_edit_language(target_language_id, auth.uid()) then
    raise exception 'You do not have permission to edit templates.' using errcode = '42501';
  end if;

  select * into existing
  from public.page_templates template
  where template.id = target_template_id
    and template.site_language_id = target_language_id
  for update;
  if not found then raise exception 'Template not found.'; end if;
  if existing.is_fallback then raise exception 'The fallback template cannot be deleted.'; end if;

  update public.pages
  set preferred_child_template = null
  where site_language_id = target_language_id
    and preferred_child_template = existing.key;

  delete from public.page_templates where id = target_template_id;
end;
$$;

revoke all on function public.get_page_template_workspace(uuid) from public, anon;
revoke all on function public.save_page_template(uuid, uuid, text, text, text, text, text, boolean, jsonb, text, jsonb) from public, anon;
revoke all on function public.set_fallback_page_template(uuid, uuid) from public, anon;
revoke all on function public.delete_page_template(uuid, uuid) from public, anon;

grant execute on function public.get_page_template_workspace(uuid) to authenticated;
grant execute on function public.save_page_template(uuid, uuid, text, text, text, text, text, boolean, jsonb, text, jsonb) to authenticated;
grant execute on function public.set_fallback_page_template(uuid, uuid) to authenticated;
grant execute on function public.delete_page_template(uuid, uuid) to authenticated;
