alter table public.pages
  add column if not exists content_blocks jsonb not null default '[]'::jsonb,
  add column if not exists seo_title text not null default '',
  add column if not exists seo_description text not null default '',
  add column if not exists social_image text,
  add column if not exists preferred_child_template text;

alter table public.pages
  add constraint pages_content_blocks_is_array
  check (jsonb_typeof(content_blocks) = 'array');

update public.pages
set
  title = 'Product launch announcement',
  content_blocks = jsonb_build_array(
    jsonb_build_object('id', 'hero', 'type', 'hero', 'data', jsonb_build_object('eyebrow', 'Product news', 'headline', 'Introducing Scaffold CMS 1.0', 'subheadline', 'The website-native, headless CMS is now generally available, open source and ready to self-host.')),
    jsonb_build_object('id', 'richtext', 'type', 'richtext', 'data', jsonb_build_object('body', E'Today we are making Scaffold CMS generally available. It rethinks the headless CMS around a canonical page tree, so editors always understand where a page lives and what its URL is.\n\nEvery structural change shows its impact up front and keeps redirects intact.')),
    jsonb_build_object('id', 'quote', 'type', 'quote', 'data', jsonb_build_object('text', 'Finally, a CMS our editors actually understand.', 'cite', 'Early-access customer')),
    jsonb_build_object('id', 'image', 'type', 'image', 'data', jsonb_build_object('alt', 'The canonical page tree in the Scaffold CMS admin', 'caption', 'The page tree is the primary way editors navigate a site.')),
    jsonb_build_object('id', 'cta', 'type', 'cta', 'data', jsonb_build_object('heading', 'Ready to build something?', 'button', 'Start with Scaffold CMS'))
  ),
  seo_title = 'Introducing Scaffold CMS 1.0',
  seo_description = '',
  social_image = 'og-default.png',
  preferred_child_template = 'News article'
where slug = 'product-launch';
