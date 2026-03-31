-- supabase/migration.sql
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  public_slug text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Anyone can read profiles"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url, public_slug)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''),
    new.id::text
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Search history table
create table public.search_history (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  keyword text not null,
  type text not null check (type in ('book', 'movie', 'author')),
  extra jsonb default '{}'::jsonb,
  searched_at timestamptz default now(),
  unique (user_id, keyword, type)
);

alter table public.search_history enable row level security;

create policy "Users can read own search history"
  on public.search_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own search history"
  on public.search_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own search history"
  on public.search_history for delete
  using (auth.uid() = user_id);

create index idx_search_history_user_recent
  on public.search_history (user_id, searched_at desc);

-- 3. Bookmarks table (Phase 2, but create now to avoid future migration)
create table public.bookmarks (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  item_id text not null,
  item_type text not null check (item_type in ('book', 'movie')),
  item_title text not null,
  item_cover_url text,
  status text not null check (status in ('want', 'done')),
  recommendation text check (recommendation in ('up', 'down')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, item_id, item_type)
);

alter table public.bookmarks enable row level security;

create policy "Users can read own bookmarks"
  on public.bookmarks for select
  using (auth.uid() = user_id);

create policy "Public can read recommended bookmarks"
  on public.bookmarks for select
  using (status = 'done' and recommendation = 'up');

create policy "Users can insert own bookmarks"
  on public.bookmarks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bookmarks"
  on public.bookmarks for update
  using (auth.uid() = user_id);

create policy "Users can delete own bookmarks"
  on public.bookmarks for delete
  using (auth.uid() = user_id);

create index idx_bookmarks_user_status
  on public.bookmarks (user_id, status);

create index idx_bookmarks_public_recommendations
  on public.bookmarks (user_id)
  where status = 'done' and recommendation = 'up';
