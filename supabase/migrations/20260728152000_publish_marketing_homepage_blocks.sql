do $migration$
declare
  homepage public.pages%rowtype;
  next_concept_version integer;
  next_published_version integer;
  new_concept_revision_id uuid := gen_random_uuid();
  new_published_revision_id uuid;
  homepage_blocks jsonb := $blocks$
[
  {
    "id": "marketing-hero",
    "type": "hero",
    "version": 1,
    "data": {
      "eyebrow": "Published API available",
      "headline": "The headless CMS that thinks in pages, not tables.",
      "subheadline": "Model a real page tree, keep clean URLs and redirects, and deliver published content to any front end over REST or GraphQL.",
      "primaryLabel": "Explore the CMS",
      "primaryUrl": "/help/getting-started",
      "secondaryLabel": "See live CMS data",
      "secondaryUrl": "#live-content",
      "highlights": "Website-native\nPublished reads only\nBring your own front end",
      "imageSrc": "/screenshots/page-tree-dark.png",
      "imageAlt": "Scaffold CMS page tree showing nested pages and publishing states",
      "imageLabel": "localhost:4000/pages"
    }
  },
  {
    "id": "marketing-metrics",
    "type": "metrics",
    "version": 1,
    "data": {
      "accessibleLabel": "Product capabilities",
      "items": "{pageCount} | published pages connected\nREST + GraphQL | typed delivery contracts\nURL lookup | fetch a page by its path"
    }
  },
  {
    "id": "marketing-steps",
    "type": "steps",
    "version": 1,
    "data": {
      "eyebrow": "How it works",
      "heading": "From content model to live website in four moves.",
      "introduction": "This text is different.\n\nThis standalone Next.js website fetches published pages, navigation, and redirects from the same site-scoped delivery API used by any production front end.",
      "items": "database | Run the CMS | Start the administration app against Postgres and create your first site.\ntree | Model your tree | Create pages in a canonical hierarchy. Their paths follow naturally.\nstack | Compose content | Use templates, page blocks, and structured records to keep content consistent.\nrocket | Publish anywhere | Fetch published content over REST or GraphQL from any front-end stack."
    }
  },
  {
    "id": "marketing-feature-tree",
    "type": "feature",
    "version": 1,
    "data": {
      "eyebrow": "Canonical page tree",
      "title": "Your site is a tree. Model it like one.",
      "body": "Every page has one canonical home. Reorder and nest pages while the content model stays aligned with the URLs visitors use.",
      "points": "Visible hierarchy and paths\nTemplates per page type\nMultiple published languages",
      "icon": "tree",
      "visual": "image",
      "imageSrc": "/screenshots/page-tree-light.png",
      "imageAlt": "Page tree with nested news, blog, and product pages"
    }
  },
  {
    "id": "marketing-feature-redirects",
    "type": "feature",
    "version": 1,
    "data": {
      "eyebrow": "Redirect safety",
      "title": "Move a page. Keep every old link alive.",
      "body": "The CMS records redirects when paths change and validates manual rules before they reach your website.",
      "points": "301 and 302 rules\nLoop detection\nPublished redirect delivery",
      "icon": "redirect",
      "visual": "redirects",
      "redirects": "/old-about | /about | 301\n/journal | /blog | 301\n/start | /help/getting-started | 302"
    }
  },
  {
    "id": "marketing-feature-content",
    "type": "feature",
    "version": 1,
    "data": {
      "eyebrow": "Structured content",
      "title": "Reusable data, without flattening the website.",
      "body": "Keep records such as people, locations, and FAQs reusable while pages remain the backbone of the site.",
      "points": "Schema-driven fields\nLocalized records\nStrong content contracts",
      "icon": "content",
      "visual": "content",
      "recordTitle": "Team member",
      "recordStatus": "Published",
      "recordFields": "Name | Amina Yusuf\nRole | Lead engineer\nExpertise | APIs · Content modelling"
    }
  },
  {
    "id": "marketing-feature-api",
    "type": "feature",
    "version": 1,
    "data": {
      "eyebrow": "Headless delivery",
      "title": "A typed API for the front end you choose.",
      "body": "This website is already reading Scaffold through GraphQL. The same published model is available over REST.",
      "points": "Token-gated published reads\nPage lookup by URL\nGraphQL schema explorer",
      "icon": "api",
      "visual": "code",
      "codeLanguage": "GraphQL",
      "code": "query WebsitePage($url: String!) {\n  page(url: $url) {\n    title\n    path\n    blocks { __typename }\n  }\n}"
    }
  },
  {
    "id": "marketing-page-list",
    "type": "pageList",
    "version": 1,
    "data": {
      "eyebrow": "Live from GraphQL",
      "heading": "These routes come from the CMS you are running.",
      "body": "Connected to “{siteName}”. Open a page to see the generic published-page renderer.",
      "maxItems": "6",
      "emptyTitle": "Waiting for published CMS content",
      "emptyBody": "The marketing site remains usable while the CMS is unavailable."
    }
  },
  {
    "id": "marketing-faq",
    "type": "faq",
    "version": 1,
    "data": {
      "eyebrow": "FAQ",
      "heading": "Questions, answered.",
      "items": "What does website-native mean? | Pages, paths, navigation, languages, and redirects are first-class concepts. Editors work with the shape of the website instead of a flat list of database entries.\nCan I use Next.js, Astro, or another framework? | Yes. Scaffold only delivers content. Your front end owns rendering, deployment, and the user experience.\nDoes the public API expose drafts? | No. Publishable tokens currently read published content only. Preview-only credentials and draft delivery remain separate future work.\nHow quickly do published changes appear? | That is controlled by the website. This example fetches fresh content on every local-development request, while production prebuilds known pages and revalidates CMS reads every minute by default."
    }
  },
  {
    "id": "marketing-cta",
    "type": "cta",
    "version": 1,
    "data": {
      "heading": "Own your content and your URLs.",
      "body": "Use Scaffold as the content layer, then make the website entirely your own.",
      "primaryLabel": "Get started",
      "primaryUrl": "/help/getting-started",
      "secondaryLabel": "Read the docs",
      "secondaryUrl": "/help"
    }
  }
]
$blocks$::jsonb;
begin
  select page.*
  into homepage
  from public.pages page
  join public.site_languages language on language.id = page.site_language_id
  join public.sites site on site.id = language.site_id
  where site.slug = 'site-b562e3a7fd91'
    and language.code = 'en'
    and page.is_homepage
  for update of page;

  if homepage.id is null then
    raise exception 'The Scaffold CMS English homepage was not found';
  end if;

  select coalesce(max(revision.version), 0) + 1
  into next_concept_version
  from public.page_revisions revision
  where revision.page_id = homepage.id;

  update public.pages
  set
    content_blocks = homepage_blocks,
    validation_status = 'ready',
    concept_revision_id = new_concept_revision_id
  where id = homepage.id
  returning * into homepage;

  insert into public.page_revisions (
    id,
    page_id,
    site_language_id,
    version,
    snapshot
  ) values (
    new_concept_revision_id,
    homepage.id,
    homepage.site_language_id,
    next_concept_version,
    private.page_snapshot(homepage)
  );

  select coalesce(max(revision.version), 0) + 1
  into next_published_version
  from public.page_published_revisions revision
  where revision.page_id = homepage.id;

  insert into public.page_published_revisions (
    page_id,
    site_language_id,
    version,
    snapshot,
    source_concept_revision_id
  ) values (
    homepage.id,
    homepage.site_language_id,
    next_published_version,
    private.page_snapshot(homepage),
    new_concept_revision_id
  )
  returning id into new_published_revision_id;

  update public.pages
  set
    status = 'published',
    published_revision_id = new_published_revision_id
  where id = homepage.id;
end;
$migration$;
