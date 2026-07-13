do $$
declare
  language_id uuid;
  platform_id uuid;
  help_id uuid;
  getting_started_id uuid;
  developer_tools_id uuid;
  sdks_id uuid;
  integrations_id uuid;
  installation_id uuid;
  hosting_id uuid;
begin
  select page.site_language_id into language_id
  from public.pages page
  where page.is_homepage
  order by page.created_at
  limit 1;

  if language_id is null then
    return;
  end if;

  select id into platform_id from public.pages
  where site_language_id = language_id and title = 'Platform' limit 1;
  select id into help_id from public.pages
  where site_language_id = language_id and title = 'Help center' limit 1;
  select id into getting_started_id from public.pages
  where site_language_id = language_id and title = 'Getting started' limit 1;

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, platform_id, 'Developer tools', 'developer-tools', 'Standard page', 'published', 'ready', 0
  where platform_id is not null
    and not exists (select 1 from public.pages where parent_id = platform_id and slug = 'developer-tools')
  returning id into developer_tools_id;
  if developer_tools_id is null then
    select id into developer_tools_id from public.pages where parent_id = platform_id and slug = 'developer-tools';
  end if;

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, developer_tools_id, 'SDKs', 'sdks', 'Standard page', 'published', 'ready', 0
  where developer_tools_id is not null
    and not exists (select 1 from public.pages where parent_id = developer_tools_id and slug = 'sdks')
  returning id into sdks_id;
  if sdks_id is null then
    select id into sdks_id from public.pages where parent_id = developer_tools_id and slug = 'sdks';
  end if;

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, sdks_id, page.title, page.slug, 'Documentation page', page.status, page.validation, page.position
  from (values
    ('React SDK', 'react', 'published', 'ready', 0),
    ('Next.js SDK', 'nextjs', 'published', 'ready', 1),
    ('Vue SDK', 'vue', 'concept', 'needs_attention', 2)
  ) as page(title, slug, status, validation, position)
  where sdks_id is not null
    and not exists (select 1 from public.pages existing where existing.parent_id = sdks_id and existing.slug = page.slug);

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, platform_id, 'Integrations', 'integrations', 'Standard page', 'published', 'ready', 1
  where platform_id is not null
    and not exists (select 1 from public.pages where parent_id = platform_id and slug = 'integrations')
  returning id into integrations_id;
  if integrations_id is null then
    select id into integrations_id from public.pages where parent_id = platform_id and slug = 'integrations';
  end if;

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, integrations_id, page.title, page.slug, 'Integration page', page.status, 'ready', page.position
  from (values
    ('Supabase', 'supabase', 'published', 0),
    ('Vercel', 'vercel', 'published', 1),
    ('Cloudflare', 'cloudflare', 'concept', 2)
  ) as page(title, slug, status, position)
  where integrations_id is not null
    and not exists (select 1 from public.pages existing where existing.parent_id = integrations_id and existing.slug = page.slug);

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, getting_started_id, 'Installation', 'installation', 'Documentation page', 'published', 'ready', 0
  where getting_started_id is not null
    and not exists (select 1 from public.pages where parent_id = getting_started_id and slug = 'installation')
  returning id into installation_id;
  if installation_id is null then
    select id into installation_id from public.pages where parent_id = getting_started_id and slug = 'installation';
  end if;

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, installation_id, 'Hosting options', 'hosting', 'Documentation page', 'published', 'ready', 0
  where installation_id is not null
    and not exists (select 1 from public.pages where parent_id = installation_id and slug = 'hosting')
  returning id into hosting_id;
  if hosting_id is null then
    select id into hosting_id from public.pages where parent_id = installation_id and slug = 'hosting';
  end if;

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, hosting_id, page.title, page.slug, 'Documentation page', page.status, page.validation, page.position
  from (values
    ('SiteFoundry Cloud', 'cloud', 'published', 'ready', 0),
    ('Self-hosting', 'self-hosting', 'concept', 'needs_attention', 1),
    ('Docker setup', 'docker', 'concept', 'ready', 2)
  ) as page(title, slug, status, validation, position)
  where hosting_id is not null
    and not exists (select 1 from public.pages existing where existing.parent_id = hosting_id and existing.slug = page.slug);

  insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
  select language_id, help_id, page.title, page.slug, 'Documentation page', page.status, 'ready', page.position
  from (values
    ('Troubleshooting', 'troubleshooting', 'published', 2),
    ('Account and billing', 'account-billing', 'concept', 3)
  ) as page(title, slug, status, position)
  where help_id is not null
    and not exists (select 1 from public.pages existing where existing.parent_id = help_id and existing.slug = page.slug);
end;
$$;
