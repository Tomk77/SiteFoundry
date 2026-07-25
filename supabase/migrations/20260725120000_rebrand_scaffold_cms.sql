update public.profiles
set
  first_name = case
    when first_name = 'Site' || 'Foundry' then 'Scaffold'
    else first_name
  end,
  full_name = replace(full_name, 'Site' || 'Foundry', 'Scaffold CMS'),
  display_name = replace(display_name, 'Site' || 'Foundry', 'Scaffold CMS')
where
  first_name = 'Site' || 'Foundry'
  or full_name like '%' || 'Site' || 'Foundry' || '%'
  or display_name like '%' || 'Site' || 'Foundry' || '%';

update public.pages
set
  title = replace(title, 'Site' || 'Foundry', 'Scaffold CMS'),
  content_blocks = replace(content_blocks::text, 'Site' || 'Foundry', 'Scaffold CMS')::jsonb,
  seo_title = replace(seo_title, 'Site' || 'Foundry', 'Scaffold CMS'),
  seo_description = replace(seo_description, 'Site' || 'Foundry', 'Scaffold CMS')
where
  title like '%' || 'Site' || 'Foundry' || '%'
  or content_blocks::text like '%' || 'Site' || 'Foundry' || '%'
  or seo_title like '%' || 'Site' || 'Foundry' || '%'
  or seo_description like '%' || 'Site' || 'Foundry' || '%';

update public.page_templates
set
  name = replace(name, 'Site' || 'Foundry', 'Scaffold CMS'),
  description = replace(description, 'Site' || 'Foundry', 'Scaffold CMS'),
  defaults = replace(defaults::text, 'Site' || 'Foundry', 'Scaffold CMS')::jsonb,
  components = replace(components::text, 'Site' || 'Foundry', 'Scaffold CMS')::jsonb
where
  name like '%' || 'Site' || 'Foundry' || '%'
  or description like '%' || 'Site' || 'Foundry' || '%'
  or defaults::text like '%' || 'Site' || 'Foundry' || '%'
  or components::text like '%' || 'Site' || 'Foundry' || '%';

update public.page_template_revisions
set snapshot = replace(snapshot::text, 'Site' || 'Foundry', 'Scaffold CMS')::jsonb
where snapshot::text like '%' || 'Site' || 'Foundry' || '%';

update public.page_published_revisions
set snapshot = replace(snapshot::text, 'Site' || 'Foundry', 'Scaffold CMS')::jsonb
where snapshot::text like '%' || 'Site' || 'Foundry' || '%';

update public.content_record_published_revisions
set snapshot = replace(snapshot::text, 'Site' || 'Foundry', 'Scaffold CMS')::jsonb
where snapshot::text like '%' || 'Site' || 'Foundry' || '%';
