alter table public.redirects
add column if not exists status_code integer not null default 301;

alter table public.redirects
drop constraint if exists redirects_status_code_check;

alter table public.redirects
add constraint redirects_status_code_check
check (status_code in (301, 302));

alter table public.profiles
add column if not exists first_name text,
add column if not exists last_name text,
add column if not exists display_name text,
add column if not exists interface_language text not null default 'en',
add column if not exists interface_mode text not null default 'system';

alter table public.profiles
drop constraint if exists profiles_interface_mode_check;

alter table public.profiles
add constraint profiles_interface_mode_check
check (interface_mode in ('system', 'light', 'dark'));

update public.profiles
set
  first_name = coalesce(
    nullif(first_name, ''),
    nullif(split_part(trim(coalesce(full_name, '')), ' ', 1), ''),
    'SiteFoundry'
  ),
  last_name = coalesce(
    last_name,
    case
      when position(' ' in trim(coalesce(full_name, ''))) > 0
      then nullif(substring(trim(full_name) from position(' ' in trim(full_name)) + 1), '')
      else null
    end
  ),
  display_name = coalesce(nullif(display_name, ''), nullif(full_name, ''), 'SiteFoundry user');

create table if not exists public.navigation_menus (
  id uuid primary key default gen_random_uuid(),
  site_language_id uuid not null references public.site_languages(id) on delete cascade,
  location text not null check (location in ('header', 'footer')),
  draft_items jsonb not null default '[]'::jsonb check (jsonb_typeof(draft_items) = 'array'),
  published_items jsonb not null default '[]'::jsonb check (jsonb_typeof(published_items) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (site_language_id, location)
);

create index if not exists navigation_menus_language_idx
on public.navigation_menus (site_language_id);

drop trigger if exists navigation_menus_set_updated_at on public.navigation_menus;
create trigger navigation_menus_set_updated_at
before update on public.navigation_menus
for each row execute function public.set_updated_at();

alter table public.navigation_menus enable row level security;

drop policy if exists "Members can read navigation menus" on public.navigation_menus;
create policy "Members can read navigation menus"
on public.navigation_menus for select to authenticated
using (private.is_language_member(site_language_id, (select auth.uid())));

drop policy if exists "Editors can create navigation menus" on public.navigation_menus;
create policy "Editors can create navigation menus"
on public.navigation_menus for insert to authenticated
with check (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Editors can update navigation menus" on public.navigation_menus;
create policy "Editors can update navigation menus"
on public.navigation_menus for update to authenticated
using (private.can_edit_language(site_language_id, (select auth.uid())))
with check (private.can_edit_language(site_language_id, (select auth.uid())));

insert into public.navigation_menus (site_language_id, location, draft_items, published_items, published_at)
select
  language.id,
  'header',
  '[
    {"id":"header-home","kind":"link","label":"Home","target":"/","targetType":"page","newTab":false,"children":[]},
    {"id":"header-products","kind":"group","label":"Products","target":"","targetType":"page","newTab":false,"children":[
      {"id":"header-platform","kind":"link","label":"Platform","target":"/products/platform","targetType":"page","newTab":false,"children":[]},
      {"id":"header-pricing","kind":"link","label":"Pricing","target":"/products/pricing","targetType":"page","newTab":false,"children":[]},
      {"id":"header-products-overview","kind":"link","label":"Overview","target":"/products","targetType":"page","newTab":false,"children":[]}
    ]},
    {"id":"header-solutions","kind":"group","label":"Solutions","target":"","targetType":"page","newTab":false,"children":[
      {"id":"header-agencies","kind":"link","label":"For agencies","target":"/solutions/agencies","targetType":"page","newTab":false,"children":[]},
      {"id":"header-in-house","kind":"link","label":"For in-house teams","target":"/solutions/in-house","targetType":"page","newTab":false,"children":[]}
    ]},
    {"id":"header-blog","kind":"link","label":"Blog","target":"/blog","targetType":"page","newTab":false,"children":[]},
    {"id":"header-about","kind":"link","label":"About","target":"/about","targetType":"page","newTab":false,"children":[]},
    {"id":"header-cta","kind":"button","label":"Get started","target":"/contact","targetType":"page","newTab":false,"children":[]}
  ]'::jsonb,
  '[
    {"id":"header-home","kind":"link","label":"Home","target":"/","targetType":"page","newTab":false,"children":[]},
    {"id":"header-products","kind":"group","label":"Products","target":"","targetType":"page","newTab":false,"children":[
      {"id":"header-platform","kind":"link","label":"Platform","target":"/products/platform","targetType":"page","newTab":false,"children":[]},
      {"id":"header-pricing","kind":"link","label":"Pricing","target":"/products/pricing","targetType":"page","newTab":false,"children":[]},
      {"id":"header-products-overview","kind":"link","label":"Overview","target":"/products","targetType":"page","newTab":false,"children":[]}
    ]},
    {"id":"header-solutions","kind":"group","label":"Solutions","target":"","targetType":"page","newTab":false,"children":[
      {"id":"header-agencies","kind":"link","label":"For agencies","target":"/solutions/agencies","targetType":"page","newTab":false,"children":[]},
      {"id":"header-in-house","kind":"link","label":"For in-house teams","target":"/solutions/in-house","targetType":"page","newTab":false,"children":[]}
    ]},
    {"id":"header-blog","kind":"link","label":"Blog","target":"/blog","targetType":"page","newTab":false,"children":[]},
    {"id":"header-about","kind":"link","label":"About","target":"/about","targetType":"page","newTab":false,"children":[]},
    {"id":"header-cta","kind":"button","label":"Get started","target":"/contact","targetType":"page","newTab":false,"children":[]}
  ]'::jsonb,
  now()
from public.site_languages language
on conflict (site_language_id, location) do nothing;

insert into public.navigation_menus (site_language_id, location, draft_items, published_items, published_at)
select
  language.id,
  'footer',
  '[
    {"id":"footer-product","kind":"group","label":"Product","target":"","targetType":"page","newTab":false,"children":[
      {"id":"footer-platform","kind":"link","label":"Platform","target":"/products/platform","targetType":"page","newTab":false,"children":[]},
      {"id":"footer-pricing","kind":"link","label":"Pricing","target":"/products/pricing","targetType":"page","newTab":false,"children":[]},
      {"id":"footer-overview","kind":"link","label":"Overview","target":"/products","targetType":"page","newTab":false,"children":[]}
    ]},
    {"id":"footer-company","kind":"group","label":"Company","target":"","targetType":"page","newTab":false,"children":[
      {"id":"footer-about","kind":"link","label":"About","target":"/about","targetType":"page","newTab":false,"children":[]},
      {"id":"footer-careers","kind":"link","label":"Careers","target":"/careers","targetType":"page","newTab":false,"children":[]},
      {"id":"footer-blog","kind":"link","label":"Blog","target":"/blog","targetType":"page","newTab":false,"children":[]},
      {"id":"footer-contact","kind":"link","label":"Contact","target":"/contact","targetType":"page","newTab":false,"children":[]}
    ]},
    {"id":"footer-resources","kind":"group","label":"Resources","target":"","targetType":"page","newTab":false,"children":[
      {"id":"footer-help","kind":"link","label":"Help center","target":"/help","targetType":"page","newTab":false,"children":[]},
      {"id":"footer-faq","kind":"link","label":"FAQ","target":"/help/faq","targetType":"page","newTab":false,"children":[]}
    ]},
    {"id":"footer-cta","kind":"button","label":"Get started","target":"/contact","targetType":"page","newTab":false,"children":[]},
    {"id":"footer-privacy","kind":"link","label":"Privacy","target":"/privacy","targetType":"page","newTab":false,"children":[]},
    {"id":"footer-terms","kind":"link","label":"Terms","target":"/terms","targetType":"page","newTab":false,"children":[]},
    {"id":"footer-cookies","kind":"link","label":"Cookies","target":"/cookies","targetType":"page","newTab":false,"children":[]}
  ]'::jsonb,
  '[
    {"id":"footer-product","kind":"group","label":"Product","target":"","targetType":"page","newTab":false,"children":[
      {"id":"footer-platform","kind":"link","label":"Platform","target":"/products/platform","targetType":"page","newTab":false,"children":[]},
      {"id":"footer-pricing","kind":"link","label":"Pricing","target":"/products/pricing","targetType":"page","newTab":false,"children":[]},
      {"id":"footer-overview","kind":"link","label":"Overview","target":"/products","targetType":"page","newTab":false,"children":[]}
    ]},
    {"id":"footer-company","kind":"group","label":"Company","target":"","targetType":"page","newTab":false,"children":[
      {"id":"footer-about","kind":"link","label":"About","target":"/about","targetType":"page","newTab":false,"children":[]},
      {"id":"footer-careers","kind":"link","label":"Careers","target":"/careers","targetType":"page","newTab":false,"children":[]},
      {"id":"footer-blog","kind":"link","label":"Blog","target":"/blog","targetType":"page","newTab":false,"children":[]},
      {"id":"footer-contact","kind":"link","label":"Contact","target":"/contact","targetType":"page","newTab":false,"children":[]}
    ]},
    {"id":"footer-resources","kind":"group","label":"Resources","target":"","targetType":"page","newTab":false,"children":[
      {"id":"footer-help","kind":"link","label":"Help center","target":"/help","targetType":"page","newTab":false,"children":[]},
      {"id":"footer-faq","kind":"link","label":"FAQ","target":"/help/faq","targetType":"page","newTab":false,"children":[]}
    ]},
    {"id":"footer-cta","kind":"button","label":"Get started","target":"/contact","targetType":"page","newTab":false,"children":[]},
    {"id":"footer-privacy","kind":"link","label":"Privacy","target":"/privacy","targetType":"page","newTab":false,"children":[]},
    {"id":"footer-terms","kind":"link","label":"Terms","target":"/terms","targetType":"page","newTab":false,"children":[]},
    {"id":"footer-cookies","kind":"link","label":"Cookies","target":"/cookies","targetType":"page","newTab":false,"children":[]}
  ]'::jsonb,
  now()
from public.site_languages language
on conflict (site_language_id, location) do nothing;
