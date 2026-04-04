# Supabase Integration Design

## Overview

Integrate Supabase into Book Echo to add user authentication, cloud-synced search history, bookmark/collection system, and a public recommendations sharing page.

## Features

### 1. Authentication (Google + GitHub OAuth)

Supabase Auth with Google and GitHub OAuth providers. No email/password.

**Flow:**
- User clicks login → OAuth popup → redirect back → session established
- Session persisted via Supabase's built-in token refresh
- Logout clears session, app reverts to anonymous mode

### 2. Search History Sync

Replace localStorage search history with cloud storage. Upgrade path from existing local data.

**Migration strategy:**
- On first login, read localStorage search history
- Batch upsert into Supabase (deduplicate by keyword + type)
- Clear localStorage after successful migration
- Multi-device: union merge by keyword, ordered by most recent timestamp

### 3. Bookmark System (Want / Done + Recommendation)

Two-status bookmark system with optional thumbs up/down on completion.

**States:**
- `want` — 想看/想读
- `done` — 已看/已读

**On marking `done`:**
- Optional 👍 (recommend) or 👎 (not recommend)
- Can be left empty (no opinion)

**UI touchpoints:**
- Book/movie detail pages: bookmark button with status toggle
- Dedicated "My Collection" page showing want/done lists
- Status indicator on search results for bookmarked items

### 4. Public Recommendations Page

Auto-generated public page showing a user's recommended items (`done` + 👍).

**Access:** `/<public_slug>` or `/u/<public_slug>`

**Content:**
- User's display name and avatar
- Grid of recommended books and movies
- Read-only, no interaction needed

## Data Model

### `profiles`

Extends Supabase auth.users. Created automatically on first login via trigger.

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  public_slug text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### `search_history`

```sql
create table public.search_history (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  keyword text not null,
  type text not null check (type in ('book', 'movie')),
  searched_at timestamptz default now(),
  unique (user_id, keyword, type)
);
```

### `bookmarks`

```sql
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
```

> `item_title` and `item_cover_url` are denormalized here intentionally — avoids needing to call Douban API when rendering bookmark lists and the public recommendations page.

## Row Level Security (RLS)

All tables have RLS enabled.

### profiles

- **Select:** Anyone can read profiles (needed for public recommendation pages)
- **Update:** Users can only update their own profile

### search_history

- **All operations:** Users can only access their own records

### bookmarks

- **Select:** Own bookmarks + anyone can read `done` + `recommendation = 'up'` bookmarks (for public page)
- **Insert/Update/Delete:** Users can only modify their own bookmarks

## Frontend Architecture

### New Dependencies

- `@supabase/supabase-js` — Supabase client
- `@supabase/auth-ui-react` + `@supabase/auth-ui-shared` — Pre-built auth UI components

### Auth State Management

- Supabase client initialized once, shared via React context
- Auth state listener (`onAuthStateChange`) updates context
- React Query queries that depend on auth use `enabled: !!user`

### New Routes

| Route | Component | Auth Required |
|-------|-----------|---------------|
| `/login` | Login page with OAuth buttons | No |
| `/my` | User's bookmarks (want/done tabs) | Yes |
| `/u/:slug` | Public recommendations page | No |

### Existing Route Changes

- **Book/Movie detail pages:** Add bookmark button (want/done toggle + recommendation)
- **Search page:** Swap localStorage history for Supabase query (when logged in)
- **Layout:** Add user avatar/login button to header

## Unauthenticated Experience

- Search and browse work exactly as today
- Clicking bookmark triggers login prompt
- No localStorage fallback for bookmarks (only for search history pre-migration)

## Prerequisites (Manual Setup Required)

Before any implementation begins, complete these steps in the Supabase Dashboard:

- [ ] **Create Supabase project** — note down Project URL and Anon Key (Settings → API)
- [ ] **Configure Google OAuth** — create OAuth 2.0 Client ID in Google Cloud Console, set redirect URI to `https://<project>.supabase.co/auth/v1/callback`, enter credentials in Supabase Auth settings
- [ ] **Configure GitHub OAuth** — create OAuth App in GitHub Developer Settings, set callback URL to `https://<project>.supabase.co/auth/v1/callback`, enter credentials in Supabase Auth settings
- [ ] **Provide env vars** — create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

Implementation must not start until all items above are checked off.

## Environment Variables

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```
