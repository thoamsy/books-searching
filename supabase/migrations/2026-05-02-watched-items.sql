-- Add private watched history records for books, movies, and TV shows.
--
-- Tolerant of shadow-database runs:
-- - this repository keeps the original baseline SQL in supabase/migration.sql,
--   not as a timestamped migration.
-- - if public.profiles is missing in a blank shadow DB, skip this migration
--   instead of aborting local verification.

do $migration$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'profiles'
  ) then
    raise notice 'public.profiles not found; skipping watched_items creation';
    return;
  end if;

  execute $sql$
    create table if not exists public.watched_items (
      id bigint generated always as identity primary key,
      user_id uuid references public.profiles(id) on delete cascade not null,
      item_id text not null,
      item_type text not null check (item_type in ('book', 'movie')),
      media_kind text not null check (media_kind in ('book', 'movie', 'tv')),
      item_title text not null,
      item_cover_url text,
      watched_on date not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      unique (user_id, item_id, item_type)
    )
  $sql$;

  alter table public.watched_items enable row level security;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'watched_items'
      and policyname = 'Users can read own watched items'
  ) then
    create policy "Users can read own watched items"
      on public.watched_items for select
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'watched_items'
      and policyname = 'Users can insert own watched items'
  ) then
    create policy "Users can insert own watched items"
      on public.watched_items for insert
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'watched_items'
      and policyname = 'Users can update own watched items'
  ) then
    create policy "Users can update own watched items"
      on public.watched_items for update
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'watched_items'
      and policyname = 'Users can delete own watched items'
  ) then
    create policy "Users can delete own watched items"
      on public.watched_items for delete
      using ((select auth.uid()) = user_id);
  end if;

  create index if not exists idx_watched_items_user_recent
    on public.watched_items (user_id, watched_on desc, created_at desc);
end
$migration$;
