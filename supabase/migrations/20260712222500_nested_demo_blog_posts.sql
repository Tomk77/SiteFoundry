do $$
declare
  language_id uuid;
  workflow_id uuid;
  migration_id uuid;
  structure_id uuid;
  approvals_id uuid;
  inventory_id uuid;
begin
  select site_language_id into language_id
  from public.pages
  where title = 'Blog' and slug = 'blog'
  order by created_at
  limit 1;

  select id into workflow_id from public.pages
  where site_language_id = language_id and slug = 'calmer-editorial-workflow' limit 1;
  select id into migration_id from public.pages
  where site_language_id = language_id and slug = 'practical-content-migrations' limit 1;
  select id into structure_id from public.pages
  where site_language_id = language_id and slug = 'why-page-structure-matters' limit 1;

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, workflow_id, 'Editorial approvals that stay out of the way', 'editorial-approvals', 'Blog article', 'published', 'ready', 0
  where workflow_id is not null
    and not exists (select 1 from public.pages where parent_id = workflow_id and slug = 'editorial-approvals')
  returning id into approvals_id;
  if approvals_id is null then
    select id into approvals_id from public.pages where parent_id = workflow_id and slug = 'editorial-approvals';
  end if;

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, workflow_id, 'A publishing checklist editors will use', 'publishing-checklist', 'Blog article', 'concept', 'needs_attention', 1
  where workflow_id is not null
    and not exists (select 1 from public.pages where parent_id = workflow_id and slug = 'publishing-checklist');

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, approvals_id, 'Reviewing content across larger teams', 'reviewing-content-at-scale', 'Blog article', 'concept', 'ready', 0
  where approvals_id is not null
    and not exists (select 1 from public.pages where parent_id = approvals_id and slug = 'reviewing-content-at-scale');

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, migration_id, 'Start with a complete content inventory', 'content-inventory', 'Blog article', 'published', 'ready', 0
  where migration_id is not null
    and not exists (select 1 from public.pages where parent_id = migration_id and slug = 'content-inventory')
  returning id into inventory_id;
  if inventory_id is null then
    select id into inventory_id from public.pages where parent_id = migration_id and slug = 'content-inventory';
  end if;

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, inventory_id, 'Mapping old URLs to the new website', 'mapping-old-urls', 'Blog article', 'published', 'ready', 0
  where inventory_id is not null
    and not exists (select 1 from public.pages where parent_id = inventory_id and slug = 'mapping-old-urls');

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, structure_id, 'Planning a page hierarchy before building', 'planning-page-hierarchy', 'Blog article', 'published', 'ready', 0
  where structure_id is not null
    and not exists (select 1 from public.pages where parent_id = structure_id and slug = 'planning-page-hierarchy');
end;
$$;
