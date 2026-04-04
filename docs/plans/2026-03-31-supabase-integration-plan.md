# Supabase Integration Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase auth (Google + GitHub OAuth), user menu, and cloud-synced search history to Book Echo. Bookmark system and public recommendations page are deferred to Phase 2.

**Architecture:** Supabase client singleton shared via React context. Auth state drives conditional rendering (login button vs avatar) and enables cloud history sync. Search history dual-writes to both localStorage (immediate) and Supabase (async), with one-time migration on first login.

**Tech Stack:** Supabase JS v2, React 19, React Router 7, TanStack React Query 5, shadcn/ui, Tailwind CSS 4

---

## Prerequisites (Human)

Before starting any task below, the human must confirm:

- [x] Supabase project created, `.env.local` populated with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Google OAuth configured in Supabase dashboard (or skipped for now)
- [ ] GitHub OAuth configured in Supabase dashboard (or skipped for now)

---

## Phase 2 (Deferred)

These features are designed but not implemented in this phase:

- Bookmark system (want/done + 👍👎 recommendation)
- BookmarkButton on detail pages
- My Page (`/my`) with want/done tabs
- Public recommendations page (`/u/:slug`)

---

## File Map

**New files:**
- `supabase/migration.sql` — SQL to run in Supabase SQL Editor
- `src/lib/supabase.ts` — Supabase client singleton
- `src/types/supabase.ts` — TypeScript types for Supabase tables
- `src/lib/auth-context.tsx` — React context for auth state
- `src/lib/supabase-api.ts` — Supabase CRUD functions (search history + profiles)
- `src/lib/supabase-queries.ts` — React Query options for search history
- `src/routes/login-page.tsx` — OAuth login page
- `src/components/user-menu.tsx` — Header avatar / login button

**Modified files:**
- `src/main.tsx` — Wrap app with AuthProvider
- `src/router.tsx` — Add login route, add UserMenu to RootLayout
- `src/routes/search-page.tsx` — Cloud sync + localStorage migration

---

### Task 1: Database Migration SQL

**Files:**
- Create: `supabase/migration.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
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
```

- [ ] **Step 2: Human runs migration in Supabase SQL Editor**

Go to Supabase Dashboard → SQL Editor → paste the contents of `supabase/migration.sql` → Run. Verify all 3 tables appear in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migration.sql
git commit -m "feat(supabase): add migration SQL for profiles, search_history, bookmarks"
```

---

### Task 2: Supabase Client + Types

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/types/supabase.ts`

- [ ] **Step 1: Create Supabase types**

```typescript
// src/types/supabase.ts
export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchHistoryRow {
  id: number;
  user_id: string;
  keyword: string;
  type: "book" | "movie" | "author";
  extra: Record<string, unknown>;
  searched_at: string;
}

export interface BookmarkRow {
  id: number;
  user_id: string;
  item_id: string;
  item_type: "book" | "movie";
  item_title: string;
  item_cover_url: string | null;
  status: "want" | "done";
  recommendation: "up" | "down" | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Create Supabase client singleton**

```typescript
// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts src/types/supabase.ts
git commit -m "feat(supabase): add client singleton and table types"
```

---

### Task 3: Auth Context

**Files:**
- Create: `src/lib/auth-context.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create AuthProvider context**

```tsx
// src/lib/auth-context.tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  async function signInWithGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.origin },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext value={{ user, session, loading, signInWithGoogle, signInWithGitHub, signOut }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
```

- [ ] **Step 2: Wrap app with AuthProvider in main.tsx**

```tsx
// src/main.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { AuthProvider } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { router } from "@/router";
import "@/styles.css";

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: Verify dev server starts**

Run: `bun run dev`
Expected: App loads without errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth-context.tsx src/main.tsx
git commit -m "feat(auth): add AuthProvider context with Google/GitHub OAuth"
```

---

### Task 4: Login Page

**Files:**
- Create: `src/routes/login-page.tsx`
- Modify: `src/router.tsx`

- [ ] **Step 1: Add shadcn Card and Field components**

```bash
bunx shadcn@latest add card field -o
```

- [ ] **Step 2: Create login page (OAuth-only)**

```tsx
// src/routes/login-page.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldSeparator } from "@/components/ui/field";

export function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithGitHub } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--background)] px-5">
      <div className={cn("flex w-full max-w-sm flex-col gap-6")}>
        <Card className="overflow-hidden p-0">
          <CardContent className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <img src="/favicon.svg" alt="" className="size-8" />
                <h1 className="text-2xl font-bold">Welcome to Opus</h1>
                <p className="text-balance text-muted-foreground">
                  登录以同步搜索历史和收藏
                </p>
              </div>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                选择登录方式
              </FieldSeparator>
              <Field className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  type="button"
                  className="w-full"
                  onClick={signInWithGoogle}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" data-icon="inline-start">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  使用 Google 登录
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  className="w-full"
                  onClick={signInWithGitHub}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" data-icon="inline-start">
                    <path
                      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                      fill="currentColor"
                    />
                  </svg>
                  使用 GitHub 登录
                </Button>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Add login route to router.tsx**

Add inside RootLayout children, after the search page route:

```tsx
{
  path: "/login",
  lazy: () =>
    import("@/routes/login-page").then((m) => ({ Component: m.LoginPage }))
},
```

- [ ] **Step 4: Verify**

Run: `bun run dev`, navigate to `http://localhost:5173/login`
Expected: Card with "Welcome to Opus" and two OAuth buttons.

- [ ] **Step 5: Commit**

```bash
git add src/routes/login-page.tsx src/router.tsx src/components/ui/card.tsx src/components/ui/field.tsx
git commit -m "feat(auth): add login page with Google/GitHub OAuth buttons"
```

---

### Task 5: User Menu (Header Avatar / Login Button)

**Files:**
- Create: `src/components/user-menu.tsx`
- Modify: `src/router.tsx`

- [ ] **Step 1: Create UserMenu component**

Avatar comes from OAuth provider metadata: `user.user_metadata.avatar_url` (GitHub) or `user.user_metadata.picture` (Google).

```tsx
// src/components/user-menu.tsx
import { Link } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { user, loading, signOut } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Link to="/login">
        <Button variant="ghost" size="sm" className="gap-2">
          <User className="size-4" />
          登录
        </Button>
      </Link>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;
  const displayName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "User";

  return (
    <div className="flex items-center gap-2">
      <Link to="/my" className="flex items-center gap-2 rounded-full transition hover:opacity-80">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="size-7 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex size-7 items-center justify-center rounded-full bg-[var(--accent)]">
            <User className="size-3.5 text-[var(--muted-foreground)]" />
          </div>
        )}
      </Link>
      <button
        type="button"
        onClick={signOut}
        className="rounded-full p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        title="退出登录"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add UserMenu to RootLayout in router.tsx**

```tsx
import { UserMenu } from "@/components/user-menu";

function RootLayout() {
  return (
    <>
      <div className="fixed top-4 right-5 z-10 sm:right-8">
        <UserMenu />
      </div>
      <Outlet />
      <footer className="-mt-10 pb-3 text-center text-[10px] text-[var(--muted-foreground)]/30">
        <a href="https://github.com/thoamsy" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[var(--muted-foreground)]/60">
          @thoamsy
        </a>
      </footer>
      <ScrollRestoration />
    </>
  );
}
```

- [ ] **Step 3: Verify**

Run: `bun run dev`
Expected: "登录" button appears top-right on search page.

- [ ] **Step 4: Commit**

```bash
git add src/components/user-menu.tsx src/router.tsx
git commit -m "feat(auth): add user menu with avatar/login button to header"
```

---

### Task 6: Search History Cloud Sync + Migration

**Files:**
- Create: `src/lib/supabase-api.ts`
- Create: `src/lib/supabase-queries.ts`
- Modify: `src/routes/search-page.tsx`

- [ ] **Step 1: Create Supabase API functions (search history only)**

```typescript
// src/lib/supabase-api.ts
import { supabase } from "@/lib/supabase";
import type { SearchHistoryRow } from "@/types/supabase";

export async function getSearchHistory(userId: string): Promise<SearchHistoryRow[]> {
  const { data, error } = await supabase
    .from("search_history")
    .select("*")
    .eq("user_id", userId)
    .order("searched_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function upsertSearchHistory(
  userId: string,
  keyword: string,
  type: SearchHistoryRow["type"],
  extra: Record<string, unknown> = {}
) {
  const { error } = await supabase
    .from("search_history")
    .upsert(
      { user_id: userId, keyword, type, extra, searched_at: new Date().toISOString() },
      { onConflict: "user_id,keyword,type" }
    );
  if (error) throw error;
}

export async function clearSearchHistory(userId: string) {
  const { error } = await supabase
    .from("search_history")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

export async function batchUpsertSearchHistory(
  userId: string,
  entries: Array<{ keyword: string; type: SearchHistoryRow["type"]; extra?: Record<string, unknown> }>
) {
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({
    user_id: userId,
    keyword: e.keyword,
    type: e.type,
    extra: e.extra ?? {},
    searched_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("search_history")
    .upsert(rows, { onConflict: "user_id,keyword,type" });
  if (error) throw error;
}
```

- [ ] **Step 2: Create React Query options for search history**

```typescript
// src/lib/supabase-queries.ts
import { queryOptions } from "@tanstack/react-query";
import { getSearchHistory } from "@/lib/supabase-api";

export function searchHistoryQueryOptions(userId: string) {
  return queryOptions({
    queryKey: ["search-history", userId],
    queryFn: () => getSearchHistory(userId),
    enabled: Boolean(userId),
    staleTime: 1000 * 60,
  });
}
```

- [ ] **Step 3: Add cloud sync to search-page.tsx**

Add imports:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { batchUpsertSearchHistory, upsertSearchHistory, clearSearchHistory } from "@/lib/supabase-api";
```

Inside `SearchPage`, after existing state declarations, add:

```tsx
const { user } = useAuth();
const queryClient = useQueryClient();
```

Add migration effect (after existing `useEffect`s):

```tsx
// Migrate localStorage to cloud on first login
useEffect(() => {
  if (!user) return;
  const migrationKey = `opus-history-migrated-${user.id}`;
  if (localStorage.getItem(migrationKey)) return;

  const localBooks = bookHistoryStore.read();
  const localMovies = movieHistoryStore.read();
  const localAuthors = authorHistoryStore.read();

  const entries = [
    ...localBooks.map((b) => ({
      keyword: b.query,
      type: "book" as const,
      extra: { workId: b.workId, book: b.book },
    })),
    ...localMovies.map((m) => ({
      keyword: m.query,
      type: "movie" as const,
      extra: { subjectId: m.subjectId, movie: m.movie },
    })),
    ...localAuthors.map((a) => ({
      keyword: a.name,
      type: "author" as const,
      extra: { photoUrl: a.photoUrl, enName: a.enName, url: a.url },
    })),
  ];

  if (entries.length > 0) {
    batchUpsertSearchHistory(user.id, entries).then(() => {
      localStorage.setItem(migrationKey, "1");
    });
  } else {
    localStorage.setItem(migrationKey, "1");
  }
}, [user]);
```

Update `saveRecentBook` to dual-write:

```tsx
function saveRecentBook(book: SearchBook, workId: string, searchQuery: string) {
  const trimmedQuery = searchQuery.trim();
  if (!trimmedQuery) return;
  setSearchHistory((current) => {
    const next = bookHistoryStore.push(current, { workId, query: trimmedQuery, book });
    bookHistoryStore.write(next);
    return next;
  });
  if (user) {
    upsertSearchHistory(user.id, trimmedQuery, "book", { workId, book });
  }
}
```

Update `saveRecentMovie` to dual-write:

```tsx
function saveRecentMovie(movie: SearchMovie, subjectId: string, searchQuery: string) {
  const trimmedQuery = searchQuery.trim();
  if (!trimmedQuery) return;
  setMovieHistory((current) => {
    const next = movieHistoryStore.push(current, { subjectId, query: trimmedQuery, movie });
    movieHistoryStore.write(next);
    return next;
  });
  if (user) {
    upsertSearchHistory(user.id, trimmedQuery, "movie", { subjectId, movie });
  }
}
```

Update author save in `handleOptionSelect` (inside the `option.kind === "author"` branch, after `authorHistoryStore.write`):

```tsx
if (user) {
  upsertSearchHistory(user.id, option.label, "author", {
    photoUrl: option.suggest.coverUrl,
    enName: option.suggest.enName,
    url: option.suggest.url,
  });
}
```

Update "清空" button to also clear cloud:

```tsx
onClick={() => {
  setSearchHistory([]);
  bookHistoryStore.write([]);
  setAuthorHistory([]);
  authorHistoryStore.write([]);
  setMovieHistory([]);
  movieHistoryStore.write([]);
  if (user) {
    clearSearchHistory(user.id);
  }
}}
```

- [ ] **Step 4: Run type check**

Run: `bun run build`
Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase-api.ts src/lib/supabase-queries.ts src/routes/search-page.tsx
git commit -m "feat(history): add cloud sync and localStorage migration for search history"
```

---

### Smoke Test

After all tasks are complete:

1. `/` — Search page loads, "登录" button top-right
2. `/login` — Card with Google + GitHub OAuth buttons
3. Search for something → history saved to localStorage (and Supabase if logged in)
4. After login → avatar shows top-right, localStorage history migrated to cloud
5. Search again → dual-write to localStorage + Supabase
6. Clear history → both localStorage and Supabase cleared
7. `bun run build` — No TypeScript errors
