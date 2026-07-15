create table if not exists public.content_types (
  id uuid primary key default gen_random_uuid(),
  site_language_id uuid not null references public.site_languages(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  singular_name text not null check (length(trim(singular_name)) > 0),
  icon text not null default 'ph-cube',
  chip_bg text not null default '#f5e7ef',
  chip_fg text not null default '#5e299c',
  description text not null default '',
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_language_id, slug),
  unique (id, site_language_id)
);

create table if not exists public.content_fields (
  id uuid primary key default gen_random_uuid(),
  content_type_id uuid not null,
  site_language_id uuid not null,
  key text not null check (key ~ '^[a-z][a-zA-Z0-9_]*$'),
  label text not null check (length(trim(label)) > 0),
  field_type text not null check (
    field_type in (
      'text', 'long', 'rich', 'email', 'phone', 'url', 'number',
      'date', 'toggle', 'tags', 'image', 'choice', 'reference'
    )
  ),
  position integer not null default 0 check (position >= 0),
  is_primary boolean not null default false,
  is_required boolean not null default false,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (content_type_id, site_language_id)
    references public.content_types(id, site_language_id) on delete cascade,
  unique (content_type_id, key)
);

create unique index if not exists content_fields_one_primary_per_type
on public.content_fields (content_type_id)
where is_primary;

create table if not exists public.content_records (
  id uuid primary key default gen_random_uuid(),
  content_type_id uuid not null,
  site_language_id uuid not null,
  status text not null default 'concept' check (status in ('concept', 'published')),
  values jsonb not null default '{}'::jsonb check (jsonb_typeof(values) = 'object'),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (content_type_id, site_language_id)
    references public.content_types(id, site_language_id) on delete cascade
);

create index if not exists content_types_language_position_idx
on public.content_types (site_language_id, position, name);

create index if not exists content_fields_type_position_idx
on public.content_fields (content_type_id, position);

create index if not exists content_records_type_updated_idx
on public.content_records (content_type_id, updated_at desc);

create index if not exists content_records_language_status_idx
on public.content_records (site_language_id, status);

drop trigger if exists content_types_set_updated_at on public.content_types;
create trigger content_types_set_updated_at
before update on public.content_types
for each row execute function public.set_updated_at();

drop trigger if exists content_fields_set_updated_at on public.content_fields;
create trigger content_fields_set_updated_at
before update on public.content_fields
for each row execute function public.set_updated_at();

drop trigger if exists content_records_set_updated_at on public.content_records;
create trigger content_records_set_updated_at
before update on public.content_records
for each row execute function public.set_updated_at();

create or replace function public.set_content_record_updated_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists content_records_set_updated_by on public.content_records;
create trigger content_records_set_updated_by
before update on public.content_records
for each row execute function public.set_content_record_updated_by();

alter table public.content_types enable row level security;
alter table public.content_fields enable row level security;
alter table public.content_records enable row level security;

drop policy if exists "Members can read content types" on public.content_types;
create policy "Members can read content types"
on public.content_types for select to authenticated
using (private.is_language_member(site_language_id, (select auth.uid())));

drop policy if exists "Editors can create content types" on public.content_types;
create policy "Editors can create content types"
on public.content_types for insert to authenticated
with check (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Editors can update content types" on public.content_types;
create policy "Editors can update content types"
on public.content_types for update to authenticated
using (private.can_edit_language(site_language_id, (select auth.uid())))
with check (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Editors can delete content types" on public.content_types;
create policy "Editors can delete content types"
on public.content_types for delete to authenticated
using (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Members can read content fields" on public.content_fields;
create policy "Members can read content fields"
on public.content_fields for select to authenticated
using (private.is_language_member(site_language_id, (select auth.uid())));

drop policy if exists "Editors can create content fields" on public.content_fields;
create policy "Editors can create content fields"
on public.content_fields for insert to authenticated
with check (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Editors can update content fields" on public.content_fields;
create policy "Editors can update content fields"
on public.content_fields for update to authenticated
using (private.can_edit_language(site_language_id, (select auth.uid())))
with check (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Editors can delete content fields" on public.content_fields;
create policy "Editors can delete content fields"
on public.content_fields for delete to authenticated
using (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Members can read content records" on public.content_records;
create policy "Members can read content records"
on public.content_records for select to authenticated
using (private.is_language_member(site_language_id, (select auth.uid())));

drop policy if exists "Editors can create content records" on public.content_records;
create policy "Editors can create content records"
on public.content_records for insert to authenticated
with check (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Editors can update content records" on public.content_records;
create policy "Editors can update content records"
on public.content_records for update to authenticated
using (private.can_edit_language(site_language_id, (select auth.uid())))
with check (private.can_edit_language(site_language_id, (select auth.uid())));

drop policy if exists "Editors can delete content records" on public.content_records;
create policy "Editors can delete content records"
on public.content_records for delete to authenticated
using (private.can_edit_language(site_language_id, (select auth.uid())));

create or replace function public.save_content_type(
  target_language_id uuid,
  target_type_id uuid,
  target_slug text,
  target_name text,
  target_singular_name text,
  target_icon text,
  target_description text,
  target_fields jsonb
)
returns uuid
language plpgsql
set search_path = public, private
as $$
declare
  saved_type_id uuid;
  field_item jsonb;
  field_position integer := 0;
begin
  if not private.can_edit_language(target_language_id, auth.uid()) then
    raise exception 'You do not have permission to edit structured content';
  end if;

  if jsonb_typeof(target_fields) <> 'array' or jsonb_array_length(target_fields) = 0 then
    raise exception 'A content type needs at least one field';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(target_fields) item
    where coalesce((item ->> 'primary')::boolean, false)
  ) <> 1 then
    raise exception 'A content type needs exactly one primary field';
  end if;

  if target_type_id is null then
    insert into public.content_types (
      site_language_id, slug, name, singular_name, icon, description, position
    )
    values (
      target_language_id,
      target_slug,
      trim(target_name),
      trim(target_singular_name),
      target_icon,
      target_description,
      coalesce((select max(position) + 1 from public.content_types where site_language_id = target_language_id), 0)
    )
    returning id into saved_type_id;
  else
    update public.content_types
    set
      slug = target_slug,
      name = trim(target_name),
      singular_name = trim(target_singular_name),
      icon = target_icon,
      description = target_description
    where id = target_type_id
      and site_language_id = target_language_id
    returning id into saved_type_id;

    if saved_type_id is null then
      raise exception 'Content type not found';
    end if;

    delete from public.content_fields where content_type_id = saved_type_id;
  end if;

  for field_item in select value from jsonb_array_elements(target_fields)
  loop
    insert into public.content_fields (
      content_type_id,
      site_language_id,
      key,
      label,
      field_type,
      position,
      is_primary,
      is_required,
      options
    )
    values (
      saved_type_id,
      target_language_id,
      field_item ->> 'key',
      field_item ->> 'label',
      field_item ->> 'type',
      field_position,
      coalesce((field_item ->> 'primary')::boolean, false),
      coalesce((field_item ->> 'required')::boolean, false),
      coalesce(field_item -> 'options', '[]'::jsonb)
    );
    field_position := field_position + 1;
  end loop;

  return saved_type_id;
end;
$$;

revoke all on function public.save_content_type(uuid, uuid, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.save_content_type(uuid, uuid, text, text, text, text, text, jsonb) to authenticated;

create or replace function public.seed_default_structured_content(target_language_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  type_id uuid;
begin
  insert into public.content_types (site_language_id, slug, name, singular_name, icon, chip_bg, chip_fg, description, position)
  values
    (target_language_id, 'colleagues', 'Colleagues', 'colleague', 'ph-users', '#ede7f5', '#5b4b8a', 'People shown in team sections and author bylines.', 0),
    (target_language_id, 'locations', 'Locations', 'location', 'ph-map-pin', '#e1eef0', '#2c6e78', 'Offices and venues referenced on contact pages.', 1),
    (target_language_id, 'job-openings', 'Job openings', 'opening', 'ph-briefcase', '#e7eaf5', '#3f4c8a', 'Vacancies rendered on the careers page.', 2),
    (target_language_id, 'faq-items', 'FAQ items', 'question', 'ph-question', '#f5e7ef', '#5e299c', 'Question and answer pairs reused across help pages.', 3),
    (target_language_id, 'testimonials', 'Testimonials', 'testimonial', 'ph-quotes', '#eaecef', '#4a5064', 'Customer quotes used on landing pages.', 4)
  on conflict (site_language_id, slug) do nothing;

  select id into type_id from public.content_types where site_language_id = target_language_id and slug = 'colleagues';
  insert into public.content_fields (content_type_id, site_language_id, key, label, field_type, position, is_primary, is_required, options)
  values
    (type_id, target_language_id, 'name', 'Full name', 'text', 0, true, true, '[]'),
    (type_id, target_language_id, 'role', 'Role', 'text', 1, false, false, '[]'),
    (type_id, target_language_id, 'email', 'Email', 'email', 2, false, false, '[]'),
    (type_id, target_language_id, 'phone', 'Phone', 'phone', 3, false, false, '[]'),
    (type_id, target_language_id, 'department', 'Department', 'choice', 4, false, false, '["Engineering","Design","Marketing","Sales","Operations"]'),
    (type_id, target_language_id, 'photo', 'Photo', 'image', 5, false, false, '[]'),
    (type_id, target_language_id, 'startDate', 'Start date', 'date', 6, false, false, '[]'),
    (type_id, target_language_id, 'website', 'Personal site', 'url', 7, false, false, '[]'),
    (type_id, target_language_id, 'skills', 'Skills', 'tags', 8, false, false, '[]'),
    (type_id, target_language_id, 'featured', 'Featured on team page', 'toggle', 9, false, false, '[]'),
    (type_id, target_language_id, 'bio', 'Biography', 'rich', 10, false, false, '[]')
  on conflict (content_type_id, key) do nothing;

  if not exists (select 1 from public.content_records where content_type_id = type_id) then
    insert into public.content_records (content_type_id, site_language_id, status, values)
    values
      (type_id, target_language_id, 'published', '{"name":"Mara Jensen","role":"Head of Content","email":"mara@acme.com","phone":"+31 20 555 0110","department":"Marketing","startDate":"2021-03-01","website":"https://marajensen.com","skills":["Editorial","SEO","Localization"],"featured":true,"bio":"Mara leads content strategy across every site."}'),
      (type_id, target_language_id, 'published', '{"name":"Deniz Kaya","role":"Senior Engineer","email":"deniz@acme.com","phone":"+31 20 555 0112","department":"Engineering","skills":["TypeScript","React","Infra"],"featured":true,"bio":"Deniz builds the rendering pipeline."}'),
      (type_id, target_language_id, 'published', '{"name":"Lotte Visser","role":"Product Designer","email":"lotte@acme.com","department":"Design","skills":["UI","Prototyping"],"featured":false,"bio":"Lotte owns the design system."}'),
      (type_id, target_language_id, 'concept', '{"name":"Sam Okafor","role":"Account Executive","email":"sam@acme.com","department":"Sales","skills":[],"featured":false,"bio":""}');
  end if;

  select id into type_id from public.content_types where site_language_id = target_language_id and slug = 'locations';
  insert into public.content_fields (content_type_id, site_language_id, key, label, field_type, position, is_primary, is_required, options)
  values
    (type_id, target_language_id, 'name', 'Name', 'text', 0, true, true, '[]'),
    (type_id, target_language_id, 'city', 'City', 'text', 1, false, false, '[]'),
    (type_id, target_language_id, 'address', 'Address', 'text', 2, false, false, '[]'),
    (type_id, target_language_id, 'phone', 'Phone', 'phone', 3, false, false, '[]')
  on conflict (content_type_id, key) do nothing;

  select id into type_id from public.content_types where site_language_id = target_language_id and slug = 'job-openings';
  insert into public.content_fields (content_type_id, site_language_id, key, label, field_type, position, is_primary, is_required, options)
  values
    (type_id, target_language_id, 'title', 'Title', 'text', 0, true, true, '[]'),
    (type_id, target_language_id, 'team', 'Team', 'choice', 1, false, false, '["Engineering","Design","Marketing","Sales","Operations"]'),
    (type_id, target_language_id, 'location', 'Location', 'text', 2, false, false, '[]'),
    (type_id, target_language_id, 'mode', 'Type', 'choice', 3, false, false, '["Full-time","Part-time","Contract"]')
  on conflict (content_type_id, key) do nothing;

  select id into type_id from public.content_types where site_language_id = target_language_id and slug = 'faq-items';
  insert into public.content_fields (content_type_id, site_language_id, key, label, field_type, position, is_primary, is_required, options)
  values
    (type_id, target_language_id, 'question', 'Question', 'text', 0, true, true, '[]'),
    (type_id, target_language_id, 'answer', 'Answer', 'rich', 1, false, true, '[]'),
    (type_id, target_language_id, 'topic', 'Topic', 'choice', 2, false, false, '["Billing","Account","Product","Privacy"]')
  on conflict (content_type_id, key) do nothing;

  select id into type_id from public.content_types where site_language_id = target_language_id and slug = 'testimonials';
  insert into public.content_fields (content_type_id, site_language_id, key, label, field_type, position, is_primary, is_required, options)
  values
    (type_id, target_language_id, 'quote', 'Quote', 'long', 0, true, true, '[]'),
    (type_id, target_language_id, 'author', 'Author', 'text', 1, false, false, '[]'),
    (type_id, target_language_id, 'role', 'Role or company', 'text', 2, false, false, '[]')
  on conflict (content_type_id, key) do nothing;
end;
$$;

revoke all on function public.seed_default_structured_content(uuid) from public, anon, authenticated;

create or replace function public.seed_structured_content_for_language()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_structured_content(new.id);
  return new;
end;
$$;

drop trigger if exists seed_structured_content_on_language_created on public.site_languages;
create trigger seed_structured_content_on_language_created
after insert on public.site_languages
for each row execute function public.seed_structured_content_for_language();

do $$
declare
  language_row record;
begin
  for language_row in select id from public.site_languages
  loop
    perform public.seed_default_structured_content(language_row.id);
  end loop;
end;
$$;
