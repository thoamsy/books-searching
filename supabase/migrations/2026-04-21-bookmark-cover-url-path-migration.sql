-- Normalize stored bookmark cover URLs from the legacy
-- `/api/douban/image?url=...` proxy format to `/media/douban/...`.
--
-- Safe to run multiple times:
-- - rows already using `/media/douban/` are unchanged
-- - non-proxied URLs are unchanged
--
-- Applies to:
-- - public.bookmarks.item_cover_url
-- - public.bookmarks.item_cover_urls (collection thumbnails)

begin;

create or replace function public.normalize_bookmark_cover_url(value text)
returns text
language sql
immutable
as $$
  select
    case
      when value is null then null
      when value ~ '^https?://[^/]+/api/douban/image\?url=' then
        regexp_replace(value, '^https?://[^/]+/api/douban/image\?url=', '/media/douban/')
      when value like '/api/douban/image?url=%' then
        replace(value, '/api/douban/image?url=', '/media/douban/')
      else value
    end
$$;

update public.bookmarks
set item_cover_url = public.normalize_bookmark_cover_url(item_cover_url)
where item_cover_url is not null
  and (
    item_cover_url ~ '^https?://[^/]+/api/douban/image\?url='
    or item_cover_url like '/api/douban/image?url=%'
  );

with normalized_arrays as (
  select
    b.id,
    array_agg(public.normalize_bookmark_cover_url(url) order by ordinality) as normalized_urls
  from public.bookmarks b
  cross join lateral unnest(coalesce(b.item_cover_urls, '{}'::text[])) with ordinality as item(url, ordinality)
  where b.item_cover_urls is not null
  group by b.id
)
update public.bookmarks b
set item_cover_urls = n.normalized_urls
from normalized_arrays n
where b.id = n.id
  and exists (
    select 1
    from unnest(n.normalized_urls) as normalized_url
    where normalized_url ~ '^/media/douban/'
  );

commit;

-- Optional verification queries:
--
-- select count(*) as legacy_single_urls
-- from public.bookmarks
-- where item_cover_url ~ '^https?://[^/]+/api/douban/image\?url='
--    or item_cover_url like '/api/douban/image?url=%';
--
-- select count(*) as legacy_array_urls
-- from public.bookmarks
-- where exists (
--   select 1
--   from unnest(coalesce(item_cover_urls, '{}'::text[])) as url
--   where url ~ '^https?://[^/]+/api/douban/image\?url='
--      or url like '/api/douban/image?url=%'
-- );
