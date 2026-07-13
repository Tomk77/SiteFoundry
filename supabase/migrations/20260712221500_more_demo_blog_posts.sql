do $$
declare
  language_id uuid;
  blog_id uuid;
  next_position integer;
begin
  select id, site_language_id into blog_id, language_id
  from public.pages
  where title = 'Blog' and slug = 'blog'
  order by created_at
  limit 1;

  if blog_id is null then
    return;
  end if;

  select coalesce(max(position), -1) + 1 into next_position
  from public.pages
  where parent_id = blog_id;

  insert into public.pages (
    site_language_id,
    parent_id,
    title,
    slug,
    template_name,
    status,
    validation_status,
    position
  )
  select
    language_id,
    blog_id,
    post.title,
    post.slug,
    'Blog article',
    post.status,
    post.validation,
    next_position + post.sort_offset
  from (values
    ('Building a calmer editorial workflow', 'calmer-editorial-workflow', 'published', 'ready', 0),
    ('Why page structure matters', 'why-page-structure-matters', 'published', 'ready', 1),
    ('Previewing content without surprises', 'previewing-content-without-surprises', 'concept', 'ready', 2),
    ('A practical guide to content migrations', 'practical-content-migrations', 'published', 'ready', 3),
    ('Designing reusable website sections', 'reusable-website-sections', 'concept', 'needs_attention', 4),
    ('What editors need from a modern CMS', 'what-editors-need', 'published', 'ready', 5),
    ('Keeping URLs stable while your site evolves', 'keeping-urls-stable', 'concept', 'needs_attention', 6),
    ('From content model to published page', 'content-model-to-published-page', 'published', 'ready', 7)
  ) as post(title, slug, status, validation, sort_offset)
  where not exists (
    select 1 from public.pages existing
    where existing.parent_id = blog_id and existing.slug = post.slug
  );
end;
$$;
