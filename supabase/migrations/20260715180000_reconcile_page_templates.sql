begin;

with legacy_templates as (
  select distinct
    page.site_language_id,
    page.template_name,
    lower(trim(both '-' from regexp_replace(page.template_name, '[^a-zA-Z0-9]+', '-', 'g'))) as template_key
  from public.pages page
  where page.template_name is not null
    and btrim(page.template_name) <> ''
), normalized_templates as (
  select
    legacy.site_language_id,
    legacy.template_name,
    case
      when legacy.template_key ~ '^[a-z]' then legacy.template_key
      else 'template-' || legacy.template_key
    end as template_key
  from legacy_templates legacy
  where legacy.template_key <> ''
)
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
  components
)
select
  legacy.site_language_id,
  legacy.template_key,
  legacy.template_name,
  'Starting point for existing ' || lower(legacy.template_name) || ' content.',
  case
    when lower(legacy.template_name) like '%news%' then 'ph-newspaper'
    when lower(legacy.template_name) like '%blog%' then 'ph-article'
    when lower(legacy.template_name) like '%documentation%' then 'ph-book-open-text'
    when lower(legacy.template_name) like '%guide%' then 'ph-map-trifold'
    when lower(legacy.template_name) like '%product%' then 'ph-package'
    when lower(legacy.template_name) like '%integration%' then 'ph-plugs-connected'
    when lower(legacy.template_name) like '%listing%' then 'ph-list-bullets'
    when lower(legacy.template_name) like '%overview%' then 'ph-squares-four'
    else 'ph-file'
  end,
  'published',
  false,
  '{"seoTitle":"","seoDescription":""}'::jsonb,
  '/preview/' || legacy.template_key,
  jsonb_build_array(
    jsonb_build_object(
      'type', 'hero',
      'values', jsonb_build_object(
        'eyebrow', '',
        'headline', legacy.template_name,
        'subheadline', 'Introduce this page.',
        'align', 'Left',
        'media', '',
        'fullBleed', false
      )
    ),
    jsonb_build_object(
      'type', 'richtext',
      'values', jsonb_build_object('body', 'Start writing here.')
    )
  )
from normalized_templates legacy
where not exists (
  select 1
  from public.page_templates template
  where template.site_language_id = legacy.site_language_id
    and template.key = legacy.template_key
)
on conflict (site_language_id, key) do nothing;

update public.pages page
set
  created_from_template_id = template.id,
  created_from_template_key = template.key
from public.page_templates template
where page.created_from_template_id is null
  and template.site_language_id = page.site_language_id
  and template.key = case
    when lower(trim(both '-' from regexp_replace(page.template_name, '[^a-zA-Z0-9]+', '-', 'g'))) ~ '^[a-z]'
      then lower(trim(both '-' from regexp_replace(page.template_name, '[^a-zA-Z0-9]+', '-', 'g')))
    else 'template-' || lower(trim(both '-' from regexp_replace(page.template_name, '[^a-zA-Z0-9]+', '-', 'g')))
  end;

commit;
