-- WP4 finding 4.4: every new language (and so every new site) was seeded with published demo
-- colleagues, including names, email addresses and phone numbers, which went out through the
-- delivery API. New languages keep the starter content types but get no records. Existing records
-- are left untouched; remove demo records from real sites by hand if needed.

create or replace function public.seed_default_structured_content(target_language_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $seed$
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
$seed$;
