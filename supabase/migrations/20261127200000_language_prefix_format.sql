-- WP3 finding 3.2: the admin stored language prefixes as `nl/` while delivery expects `nl`, so pages
-- in non-default languages returned 404. One format now: lowercase segments without slashes, or
-- empty for the default language. Existing values are normalized first.

update public.site_languages
set url_prefix = lower(trim(both '/' from url_prefix))
where url_prefix <> lower(trim(both '/' from url_prefix));

alter table public.site_languages
  drop constraint if exists site_languages_url_prefix_format,
  add constraint site_languages_url_prefix_format
    check (url_prefix ~ '^([a-z0-9]+(-[a-z0-9]+)*)?$');
