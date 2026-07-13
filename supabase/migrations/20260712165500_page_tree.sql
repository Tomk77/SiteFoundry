create table if not exists public.site_languages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  code text not null,
  name text not null,
  is_default boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, code)
);

create unique index if not exists site_languages_one_default_per_site
on public.site_languages (site_id)
where is_default;

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  site_language_id uuid not null references public.site_languages(id) on delete cascade,
  parent_id uuid references public.pages(id) on delete restrict,
  title text not null,
  slug text not null default '',
  template_name text not null default 'Standard page',
  status text not null default 'concept' check (status in ('concept', 'published')),
  validation_status text not null default 'ready' check (validation_status in ('ready', 'needs_attention')),
  position integer not null default 0,
  is_homepage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_homepage and parent_id is null and slug = '')
    or
    (not is_homepage and parent_id is not null and slug <> '')
  )
);

create unique index if not exists pages_one_homepage_per_language
on public.pages (site_language_id)
where is_homepage;

create unique index if not exists pages_unique_sibling_slug
on public.pages (site_language_id, parent_id, slug)
where parent_id is not null;

create index if not exists pages_tree_order
on public.pages (site_language_id, parent_id, position);

drop trigger if exists site_languages_set_updated_at on public.site_languages;
create trigger site_languages_set_updated_at
before update on public.site_languages
for each row execute function public.set_updated_at();

drop trigger if exists pages_set_updated_at on public.pages;
create trigger pages_set_updated_at
before update on public.pages
for each row execute function public.set_updated_at();

create or replace function public.validate_page_tree()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_language_id uuid;
begin
  if new.parent_id is not null then
    select site_language_id into parent_language_id
    from public.pages
    where id = new.parent_id;

    if parent_language_id is null or parent_language_id <> new.site_language_id then
      raise exception 'A page parent must exist in the same language tree';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.parent_id is not null and exists (
    with recursive descendants as (
      select id from public.pages where parent_id = new.id
      union all
      select page.id
      from public.pages page
      join descendants on page.parent_id = descendants.id
    )
    select 1 from descendants where id = new.parent_id
  ) then
    raise exception 'A page cannot be moved beneath one of its descendants';
  end if;

  return new;
end;
$$;

drop trigger if exists pages_validate_tree on public.pages;
create trigger pages_validate_tree
before insert or update of parent_id, site_language_id on public.pages
for each row execute function public.validate_page_tree();

create or replace function public.is_language_member(target_language_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_languages language
    join public.site_members member on member.site_id = language.site_id
    where language.id = target_language_id
      and member.user_id = target_user_id
  );
$$;

revoke execute on function public.is_language_member(uuid, uuid) from public;
grant execute on function public.is_language_member(uuid, uuid) to authenticated;

create or replace function public.can_edit_language(target_language_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_languages language
    join public.site_members member on member.site_id = language.site_id
    where language.id = target_language_id
      and member.user_id = target_user_id
      and member.role in ('owner', 'admin', 'editor')
  );
$$;

revoke execute on function public.can_edit_language(uuid, uuid) from public;
grant execute on function public.can_edit_language(uuid, uuid) to authenticated;

alter table public.site_languages enable row level security;
alter table public.pages enable row level security;

drop policy if exists "Members can read site languages" on public.site_languages;
create policy "Members can read site languages"
on public.site_languages for select
to authenticated
using (public.is_site_member(site_id, auth.uid()));

drop policy if exists "Editors can create site languages" on public.site_languages;
create policy "Editors can create site languages"
on public.site_languages for insert
to authenticated
with check (
  exists (
    select 1 from public.site_members
    where site_members.site_id = site_languages.site_id
      and site_members.user_id = auth.uid()
      and site_members.role in ('owner', 'admin', 'editor')
  )
);

drop policy if exists "Editors can update site languages" on public.site_languages;
create policy "Editors can update site languages"
on public.site_languages for update
to authenticated
using (public.is_site_member(site_id, auth.uid()))
with check (public.is_site_member(site_id, auth.uid()));

drop policy if exists "Members can read pages" on public.pages;
create policy "Members can read pages"
on public.pages for select
to authenticated
using (public.is_language_member(site_language_id, auth.uid()));

drop policy if exists "Editors can create pages" on public.pages;
create policy "Editors can create pages"
on public.pages for insert
to authenticated
with check (public.can_edit_language(site_language_id, auth.uid()));

drop policy if exists "Editors can update pages" on public.pages;
create policy "Editors can update pages"
on public.pages for update
to authenticated
using (public.can_edit_language(site_language_id, auth.uid()))
with check (public.can_edit_language(site_language_id, auth.uid()));

drop policy if exists "Editors can delete pages" on public.pages;
create policy "Editors can delete pages"
on public.pages for delete
to authenticated
using (public.can_edit_language(site_language_id, auth.uid()));

create or replace function public.initialize_site_page_tree()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  language_id uuid;
begin
  insert into public.site_languages (site_id, code, name, is_default, position)
  values (new.id, 'en', 'English', true, 0)
  on conflict (site_id, code) do update set name = excluded.name
  returning id into language_id;

  insert into public.pages (
    site_language_id, parent_id, title, slug, template_name,
    status, validation_status, position, is_homepage
  )
  values (
    language_id, null, 'Home', '', 'Landing page',
    'concept', 'ready', 0, true
  )
  on conflict (site_language_id) where is_homepage do nothing;

  return new;
end;
$$;

drop trigger if exists sites_initialize_page_tree on public.sites;
create trigger sites_initialize_page_tree
after insert on public.sites
for each row execute function public.initialize_site_page_tree();

do $$
declare
  site_record record;
  language_id uuid;
  home_id uuid;
  news_id uuid;
  blog_id uuid;
  products_id uuid;
  careers_id uuid;
  help_id uuid;
begin
  for site_record in select id from public.sites loop
    insert into public.site_languages (site_id, code, name, is_default, position)
    values (site_record.id, 'en', 'English', true, 0)
    on conflict (site_id, code) do update set name = excluded.name
    returning id into language_id;

    select id into home_id
    from public.pages
    where site_language_id = language_id and is_homepage;

    if home_id is null then
      insert into public.pages (
        site_language_id, title, slug, template_name, status,
        validation_status, position, is_homepage
      )
      values (
        language_id, 'Home', '', 'Landing page', 'published',
        'ready', 0, true
      )
      returning id into home_id;
    end if;

    if (select count(*) from public.pages where site_language_id = language_id) = 1 then
      update public.pages set status = 'published' where id = home_id;

      insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
      values (language_id, home_id, 'News', 'news', 'News overview', 'published', 'ready', 0)
      returning id into news_id;

      insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
      values
        (language_id, news_id, 'Product launch', 'product-launch', 'News article', 'concept', 'needs_attention', 0),
        (language_id, news_id, 'Q2 hiring update', 'q2-hiring', 'News article', 'published', 'ready', 1),
        (language_id, news_id, 'Series B funding', 'series-b', 'News article', 'published', 'ready', 2);

      insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
      values (language_id, home_id, 'Blog', 'blog', 'Blog overview', 'published', 'ready', 1)
      returning id into blog_id;

      insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
      values
        (language_id, blog_id, 'Designing a headless page tree', 'headless-page-tree', 'Blog article', 'published', 'ready', 0),
        (language_id, blog_id, 'An editorial workflow that scales', 'editorial-workflow', 'Blog article', 'concept', 'needs_attention', 1);

      insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
      values (language_id, home_id, 'Products', 'products', 'Overview page', 'published', 'ready', 2)
      returning id into products_id;

      insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
      values
        (language_id, products_id, 'Platform', 'platform', 'Product page', 'published', 'ready', 0),
        (language_id, products_id, 'Pricing', 'pricing', 'Product page', 'published', 'ready', 1);

      insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
      values (language_id, home_id, 'Careers', 'careers', 'Landing page', 'concept', 'needs_attention', 3)
      returning id into careers_id;

      insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
      values (language_id, careers_id, 'Open roles', 'open-roles', 'Listing page', 'concept', 'needs_attention', 0);

      insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
      values
        (language_id, home_id, 'About us', 'about', 'Standard page', 'published', 'ready', 4),
        (language_id, home_id, 'Contact', 'contact', 'Standard page', 'published', 'ready', 5);

      insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
      values (language_id, home_id, 'Help center', 'help', 'Overview page', 'published', 'ready', 6)
      returning id into help_id;

      insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, validation_status, position)
      values
        (language_id, help_id, 'FAQ', 'faq', 'FAQ page', 'published', 'ready', 0),
        (language_id, help_id, 'Getting started', 'getting-started', 'Guide page', 'published', 'ready', 1);
    end if;
  end loop;
end;
$$;
