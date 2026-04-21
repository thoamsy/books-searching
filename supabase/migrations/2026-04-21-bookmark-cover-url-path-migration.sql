-- Normalize stored bookmark cover URLs from the legacy
-- `/api/douban/image?url=...` proxy format to `/media/douban/...`.
--
-- Safe to run multiple times:
-- - rows already using `/media/douban/` are unchanged
-- - non-proxied URLs are unchanged
--
-- Tolerant of shadow-database runs (e.g. `supabase db push`):
-- - wrapped in a DO block guarded by information_schema, so missing tables
--   in a blank shadow DB do not abort the migration.
--
-- Applies to:
-- - public.bookmarks.item_cover_url
-- - public.bookmarks.item_cover_urls (collection thumbnails)

do $migration$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'bookmarks'
  ) then
    raise notice 'public.bookmarks not found; skipping cover URL normalization';
    return;
  end if;

  update public.bookmarks
  set item_cover_url = regexp_replace(
    item_cover_url,
    '^https?://[^/]+/api/douban/image\?url=',
    '/media/douban/'
  )
  where item_cover_url ~ '^https?://[^/]+/api/douban/image\?url=';

  update public.bookmarks
  set item_cover_url = replace(
    item_cover_url,
    '/api/douban/image?url=',
    '/media/douban/'
  )
  where item_cover_url like '/api/douban/image?url=%';

  with legacy_rows as (
    select b.id
    from public.bookmarks b
    where b.item_cover_urls is not null
      and exists (
        select 1
        from unnest(b.item_cover_urls) as url
        where url ~ '^https?://[^/]+/api/douban/image\?url='
           or url like '/api/douban/image?url=%'
      )
  ),
  normalized_arrays as (
    select
      b.id,
      array_agg(
        case
          when url ~ '^https?://[^/]+/api/douban/image\?url=' then
            regexp_replace(
              url,
              '^https?://[^/]+/api/douban/image\?url=',
              '/media/douban/'
            )
          when url like '/api/douban/image?url=%' then
            replace(url, '/api/douban/image?url=', '/media/douban/')
          else url
        end
        order by ordinality
      ) as normalized_urls
    from public.bookmarks b
    join legacy_rows l on l.id = b.id
    cross join lateral unnest(b.item_cover_urls) with ordinality as item(url, ordinality)
    group by b.id
  )
  update public.bookmarks b
  set item_cover_urls = n.normalized_urls
  from normalized_arrays n
  where b.id = n.id;
end
$migration$;

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
