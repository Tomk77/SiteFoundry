alter table public.pages
  add column if not exists created_from_template_key text;

update public.pages
set created_from_template_key = lower(trim(both '-' from regexp_replace(template_name, '[^a-zA-Z0-9]+', '-', 'g')))
where created_from_template_key is null
  and template_name is not null
  and template_name <> '';

update public.pages
set preferred_child_template = lower(trim(both '-' from regexp_replace(preferred_child_template, '[^a-zA-Z0-9]+', '-', 'g')))
where preferred_child_template is not null
  and preferred_child_template <> ''
  and preferred_child_template !~ '^[a-z][a-z0-9-]*$';

create index if not exists pages_created_from_template_key_idx
on public.pages (site_language_id, created_from_template_key);
