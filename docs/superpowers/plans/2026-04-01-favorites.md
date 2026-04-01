# Favorites Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browsing history with a bookmark/favorites system — star books, movies, authors, celebrities from detail pages; display them on the home page.

**Architecture:** localStorage bookmark store for logged-out users, Supabase `bookmarks` table for logged-in users. TanStack Query manages fetching/mutations with optimistic updates. BookmarkButton in the nav reads route params; home page shows a mixed grid of all bookmarked items.

**Tech Stack:** React 19, TanStack Query, Supabase, React Router, Tailwind CSS 4, lucide-react

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/bookmark-store.ts` | localStorage read/write for bookmarks (logged-out) |
| Create | `src/lib/bookmark-queries.ts` | TanStack Query options, mutations, optimistic updates |
| Create | `src/components/bookmark-button.tsx` | Star toggle button for nav bar |
| Create | `src/components/bookmarks-grid.tsx` | Home page bookmarks grid display |
| Modify | `src/router.tsx` | Nav right-side: UserMenu on home, BookmarkButton on detail pages |
| Modify | `src/routes/search-page.tsx` | Remove history, add bookmarks grid |
| Modify | `src/lib/auth-context.tsx` | Trigger localStorage→cloud migration on login |
| Delete | `src/lib/history-utils.ts` | No longer needed |
| Delete | `src/lib/supabase-queries.ts` | Only contained `searchHistoryQueryOptions` |
| Modify | `src/lib/supabase-api.ts` | Remove history functions, add bookmark functions |

---

### Task 1: Bookmark localStorage Store

**Files:**
- Create: `src/lib/bookmark-store.ts`

- [ ] **Step 1: Create the bookmark store**

```typescript
// src/lib/bookmark-store.ts
import type { BookmarkRow } from "@/types/supabase";

export type LocalBookmark = Pick<BookmarkRow, "item_id" | "item_type" | "item_title" | "item_cover_url"> & {
  created_at: string;
};

const STORAGE_KEY = "bookmarks";

export function readLocalBookmarks(): LocalBookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is LocalBookmark =>
        item != null &&
        typeof item === "object" &&
        typeof (item as LocalBookmark).item_id === "string" &&
        typeof (item as LocalBookmark).item_type === "string" &&
        typeof (item as LocalBookmark).item_title === "string"
    );
  } catch {
    return [];
  }
}

export function writeLocalBookmarks(bookmarks: LocalBookmark[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function addLocalBookmark(bookmark: LocalBookmark) {
  const existing = readLocalBookmarks();
  const filtered = existing.filter((b) => b.item_id !== bookmark.item_id);
  writeLocalBookmarks([bookmark, ...filtered]);
}

export function removeLocalBookmark(itemId: string) {
  const existing = readLocalBookmarks();
  writeLocalBookmarks(existing.filter((b) => b.item_id !== itemId));
}

export function clearLocalBookmarks() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bookmark-store.ts
git commit -m "feat(bookmarks): add localStorage bookmark store"
```

---

### Task 2: Supabase Bookmark API

**Files:**
- Modify: `src/lib/supabase-api.ts`

- [ ] **Step 1: Replace history functions with bookmark functions**

Remove all four history functions (`getSearchHistory`, `upsertSearchHistory`, `clearSearchHistory`, `batchUpsertSearchHistory`) and their `SearchHistoryRow` import. Replace with:

```typescript
// src/lib/supabase-api.ts
import { supabase } from "@/lib/supabase";
import type { BookmarkRow } from "@/types/supabase";

export async function getBookmarks(userId: string): Promise<BookmarkRow[]> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addBookmark(
  userId: string,
  bookmark: Pick<BookmarkRow, "item_id" | "item_type" | "item_title" | "item_cover_url">
) {
  const { error } = await supabase.from("bookmarks").upsert(
    {
      user_id: userId,
      item_id: bookmark.item_id,
      item_type: bookmark.item_type,
      item_title: bookmark.item_title,
      item_cover_url: bookmark.item_cover_url,
      status: "want",
    },
    { onConflict: "user_id,item_id" }
  );
  if (error) throw error;
}

export async function removeBookmark(userId: string, itemId: string) {
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId);
  if (error) throw error;
}

export async function batchUpsertBookmarks(
  userId: string,
  bookmarks: Array<Pick<BookmarkRow, "item_id" | "item_type" | "item_title" | "item_cover_url">>
) {
  if (bookmarks.length === 0) return;
  const rows = bookmarks.map((b) => ({
    user_id: userId,
    item_id: b.item_id,
    item_type: b.item_type,
    item_title: b.item_title,
    item_cover_url: b.item_cover_url,
    status: "want" as const,
  }));
  const { error } = await supabase
    .from("bookmarks")
    .upsert(rows, { onConflict: "user_id,item_id" });
  if (error) throw error;
}
```

- [ ] **Step 2: Add unique constraint on bookmarks table**

The upsert uses `onConflict: "user_id,item_id"`. Verify this constraint exists on the Supabase `bookmarks` table. If not, apply a migration:

```sql
ALTER TABLE public.bookmarks
  ADD CONSTRAINT bookmarks_user_id_item_id_key UNIQUE (user_id, item_id);
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase-api.ts
git commit -m "feat(bookmarks): replace history API with bookmark CRUD"
```

---

### Task 3: Bookmark TanStack Query Layer

**Files:**
- Create: `src/lib/bookmark-queries.ts`
- Delete: `src/lib/supabase-queries.ts`

- [ ] **Step 1: Create bookmark queries and mutations**

```typescript
// src/lib/bookmark-queries.ts
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { addBookmark, getBookmarks, removeBookmark } from "@/lib/supabase-api";
import {
  addLocalBookmark,
  readLocalBookmarks,
  removeLocalBookmark,
  type LocalBookmark,
} from "@/lib/bookmark-store";
import type { BookmarkRow } from "@/types/supabase";

// Shared type for both local and cloud bookmarks displayed in UI
export type BookmarkItem = Pick<BookmarkRow, "item_id" | "item_type" | "item_title" | "item_cover_url"> & {
  created_at: string;
};

function bookmarksQueryKey(userId: string | null) {
  return ["bookmarks", userId ?? "local"] as const;
}

export function bookmarksQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: bookmarksQueryKey(userId),
    queryFn: userId
      ? async (): Promise<BookmarkItem[]> => {
          const rows = await getBookmarks(userId);
          return rows.map((r) => ({
            item_id: r.item_id,
            item_type: r.item_type,
            item_title: r.item_title,
            item_cover_url: r.item_cover_url,
            created_at: r.created_at,
          }));
        }
      : (): Promise<BookmarkItem[]> => Promise.resolve(readLocalBookmarks()),
    staleTime: userId ? 60_000 : Infinity,
  });
}

export function useIsBookmarked(itemId: string, userId: string | null) {
  const queryClient = useQueryClient();
  const data = queryClient.getQueryData<BookmarkItem[]>(bookmarksQueryKey(userId));
  return data?.some((b) => b.item_id === itemId) ?? false;
}

export function useAddBookmark() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const key = bookmarksQueryKey(userId);

  return useMutation({
    mutationFn: async (bookmark: LocalBookmark) => {
      if (userId) {
        await addBookmark(userId, bookmark);
      } else {
        addLocalBookmark(bookmark);
      }
    },
    onMutate: async (bookmark) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BookmarkItem[]>(key);
      queryClient.setQueryData<BookmarkItem[]>(key, (old = []) => [
        bookmark,
        ...old.filter((b) => b.item_id !== bookmark.item_id),
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData<BookmarkItem[]>(key, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useRemoveBookmark() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const key = bookmarksQueryKey(userId);

  return useMutation({
    mutationFn: async (itemId: string) => {
      if (userId) {
        await removeBookmark(userId, itemId);
      } else {
        removeLocalBookmark(itemId);
      }
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BookmarkItem[]>(key);
      queryClient.setQueryData<BookmarkItem[]>(key, (old = []) =>
        old.filter((b) => b.item_id !== itemId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData<BookmarkItem[]>(key, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
```

- [ ] **Step 2: Delete `src/lib/supabase-queries.ts`**

This file only contained `searchHistoryQueryOptions` which is no longer needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bookmark-queries.ts
git rm src/lib/supabase-queries.ts
git commit -m "feat(bookmarks): add TanStack Query layer with optimistic updates"
```

---

### Task 4: BookmarkButton Component

**Files:**
- Create: `src/components/bookmark-button.tsx`

- [ ] **Step 1: Create the bookmark button**

The button reads `item_id` and `item_type` from route params. It reads title and cover from the detail page's query cache when adding a bookmark.

```typescript
// src/components/bookmark-button.tsx
import { Star } from "lucide-react";
import { useParams, useLocation } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  bookmarksQueryOptions,
  useAddBookmark,
  useRemoveBookmark,
  type BookmarkItem,
} from "@/lib/bookmark-queries";
import { cn } from "@/lib/utils";
import type { BookmarkRow } from "@/types/supabase";
import type { BookDetail } from "@/types/books";
import type { MovieDetail } from "@/types/movies";
import type { CelebrityDetail } from "@/types/movies";

type BookmarkType = BookmarkRow["item_type"];

function useBookmarkContext(): { itemId: string; itemType: BookmarkType } | null {
  const params = useParams();
  const { pathname } = useLocation();

  if (params.workId) return { itemId: params.workId, itemType: "book" };
  if (params.subjectId) return { itemId: params.subjectId, itemType: "movie" };
  if (params.celebrityId) return { itemId: params.celebrityId, itemType: "celebrity" };
  if (params.authorName) return { itemId: decodeURIComponent(params.authorName), itemType: "author" };

  return null;
}

function useItemMeta(itemId: string, itemType: BookmarkType): { title: string; coverUrl: string | null } {
  const queryClient = useQueryClient();

  if (itemType === "book") {
    const detail = queryClient.getQueryData<BookDetail>(["books", "detail", itemId]);
    if (detail) return { title: detail.title, coverUrl: detail.coverUrl ?? null };
  }

  if (itemType === "movie") {
    const detail = queryClient.getQueryData<MovieDetail>(["movies", "detail", itemId]);
    if (detail) return { title: detail.title, coverUrl: detail.coverUrl ?? null };
  }

  if (itemType === "celebrity") {
    const detail = queryClient.getQueryData<CelebrityDetail>(["celebrity", "detail", itemId]);
    if (detail) return { title: detail.name, coverUrl: detail.coverUrl ?? null };
  }

  if (itemType === "author") {
    // Author pages don't have a dedicated detail query.
    // Title is the authorName (itemId). Photo comes from URL search params.
    const params = new URLSearchParams(window.location.search);
    return { title: itemId, coverUrl: params.get("photo") };
  }

  return { title: itemId, coverUrl: null };
}

export function BookmarkButton() {
  const ctx = useBookmarkContext();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: bookmarks = [] } = useQuery(bookmarksQueryOptions(userId));
  const addMutation = useAddBookmark();
  const removeMutation = useRemoveBookmark();

  if (!ctx) return null;

  const { itemId, itemType } = ctx;
  const isBookmarked = bookmarks.some((b) => b.item_id === itemId);

  function handleToggle() {
    if (!ctx) return;
    if (isBookmarked) {
      removeMutation.mutate(itemId);
    } else {
      const meta = useItemMeta(itemId, itemType);
      addMutation.mutate({
        item_id: itemId,
        item_type: itemType,
        item_title: meta.title,
        item_cover_url: meta.coverUrl,
        created_at: new Date().toISOString(),
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isBookmarked ? "取消收藏" : "加入收藏"}
      aria-pressed={isBookmarked}
      className="inline-flex items-center justify-center rounded-full p-2 transition hover:bg-accent"
    >
      <Star
        className={cn(
          "size-5 transition-colors",
          isBookmarked ? "fill-current text-star" : "text-muted-foreground"
        )}
      />
    </button>
  );
}
```

**Important fix:** The `useItemMeta` hook is called inside `handleToggle` — that's invalid (hooks can't be called inside event handlers). Instead, call it at component top level:

```typescript
export function BookmarkButton() {
  const ctx = useBookmarkContext();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: bookmarks = [] } = useQuery(bookmarksQueryOptions(userId));
  const addMutation = useAddBookmark();
  const removeMutation = useRemoveBookmark();

  // Must be called unconditionally at top level
  const meta = useItemMeta(ctx?.itemId ?? "", ctx?.itemType ?? "book");

  if (!ctx) return null;

  const { itemId, itemType } = ctx;
  const isBookmarked = bookmarks.some((b) => b.item_id === itemId);

  function handleToggle() {
    if (isBookmarked) {
      removeMutation.mutate(itemId);
    } else {
      addMutation.mutate({
        item_id: itemId,
        item_type: itemType,
        item_title: meta.title,
        item_cover_url: meta.coverUrl,
        created_at: new Date().toISOString(),
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isBookmarked ? "取消收藏" : "加入收藏"}
      aria-pressed={isBookmarked}
      className="inline-flex items-center justify-center rounded-full p-2 transition hover:bg-accent"
    >
      <Star
        className={cn(
          "size-5 transition-colors",
          isBookmarked ? "fill-current text-star" : "text-muted-foreground"
        )}
      />
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bookmark-button.tsx
git commit -m "feat(bookmarks): add BookmarkButton star toggle component"
```

---

### Task 5: Update Nav Layout in Router

**Files:**
- Modify: `src/router.tsx`

- [ ] **Step 1: Update RootLayout to swap right-side component per route**

Replace the current `RootLayout` with route-aware right side:

```typescript
// In src/router.tsx — update imports
import { createBrowserRouter, Outlet, ScrollRestoration, useLocation, useParams } from "react-router-dom";
import { bookDetailQueryOptions, searchBooksQueryOptions } from "@/lib/book-queries";
import { celebrityDetailQueryOptions, celebrityWorksQueryOptions } from "@/lib/celebrity-queries";
import { collectionItemsQueryOptions } from "@/lib/collection-queries";
import { movieDetailQueryOptions } from "@/lib/movie-queries";
import { queryClient } from "@/lib/query-client";
import { BackButton } from "@/components/back-button";
import { UserMenu } from "@/components/user-menu";
import { BookmarkButton } from "@/components/bookmark-button";

function RootLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  // Show BookmarkButton on book/movie/author/celebrity detail pages
  const isDetailWithBookmark =
    /^\/(book|movie)\//.test(pathname) ||
    /^\/celebrity\//.test(pathname) ||
    /^\/author\//.test(pathname);

  return (
    <>
      <nav className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <div>{!isHome && <BackButton />}</div>
        <div>
          {isHome ? <UserMenu /> : isDetailWithBookmark ? <BookmarkButton /> : null}
        </div>
      </nav>
      <Outlet />
      <footer className="-mt-10 pb-3 text-center text-[10px] text-muted-foreground/30">
        <a href="https://github.com/thoamsy" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-muted-foreground/60">
          @thoamsy
        </a>
      </footer>
      <ScrollRestoration />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/router.tsx
git commit -m "feat(bookmarks): show BookmarkButton on detail pages, UserMenu on home only"
```

---

### Task 6: Bookmarks Grid Component

**Files:**
- Create: `src/components/bookmarks-grid.tsx`

- [ ] **Step 1: Create the bookmarks grid for the home page**

This component displays bookmarked items in a responsive grid. It reuses the `DepthLink`, `TiltCard`, and `BookCover` components already in the codebase.

```typescript
// src/components/bookmarks-grid.tsx
import { Film, User } from "lucide-react";
import { DepthLink } from "@/components/depth-link";
import { BookCover } from "@/components/book-cover";
import { TiltCard } from "@/components/tilt-card";
import type { BookmarkItem } from "@/lib/bookmark-queries";

function bookmarkUrl(item: BookmarkItem): string {
  switch (item.item_type) {
    case "book":
      return `/book/${item.item_id}`;
    case "movie":
      return `/movie/${item.item_id}`;
    case "celebrity":
      return `/celebrity/${item.item_id}`;
    case "author":
      return `/author/${encodeURIComponent(item.item_id)}`;
  }
}

function BookmarkCard({ item }: { item: BookmarkItem }) {
  const isPerson = item.item_type === "author" || item.item_type === "celebrity";

  if (isPerson) {
    return (
      <DepthLink to={bookmarkUrl(item)} className="group flex flex-col items-center gap-2.5">
        <div className="size-20 overflow-hidden rounded-full border-2 border-white/80 shadow-warm-sm transition-shadow group-hover:shadow-warm-md sm:size-24">
          {item.item_cover_url ? (
            <img src={item.item_cover_url} alt={item.item_title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-white/80 to-accent">
              <User className="size-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <p className="max-w-full truncate text-center text-sm font-medium">{item.item_title}</p>
      </DepthLink>
    );
  }

  const variant = item.item_type === "book" ? "book" : "poster";
  const aspect = item.item_type === "book" ? "3/4" : "2/3";

  return (
    <DepthLink to={bookmarkUrl(item)} className="group">
      <TiltCard
        variant={variant}
        className="overflow-hidden rounded-lg border border-white/60 bg-white/40 shadow-warm-sm transition-shadow group-hover:shadow-warm-md"
        style={{ aspectRatio: aspect }}
      >
        {item.item_cover_url ? (
          variant === "book" ? (
            <BookCover src={item.item_cover_url} title={item.item_title} className="rounded-lg" loading="lazy" />
          ) : (
            <img src={item.item_cover_url} alt={item.item_title} className="h-full w-full rounded-lg object-cover" loading="lazy" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(231,211,185,0.94))]">
            <Film className="size-10 text-muted-foreground" />
          </div>
        )}
      </TiltCard>
      <div className="mt-2 px-0.5">
        <p className="truncate text-sm font-medium text-foreground">{item.item_title}</p>
      </div>
    </DepthLink>
  );
}

export function BookmarksGrid({ items }: { items: BookmarkItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-white/70 bg-surface px-8 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          还没有收藏，浏览作品时点击星标即可收藏
        </p>
      </div>
    );
  }

  // Separate persons from media for display
  const persons = items.filter((i) => i.item_type === "author" || i.item_type === "celebrity");
  const media = items.filter((i) => i.item_type === "book" || i.item_type === "movie");

  return (
    <div className="flex flex-col gap-10">
      {persons.length > 0 ? (
        <section>
          <h2 className="mb-5 text-xs uppercase tracking-[0.28em] text-muted-foreground">收藏影人 / 作者</h2>
          <div className="flex flex-wrap gap-6">
            {persons.map((item) => (
              <BookmarkCard key={item.item_id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {media.length > 0 ? (
        <section>
          {persons.length > 0 ? (
            <h2 className="mb-5 text-xs uppercase tracking-[0.28em] text-muted-foreground">收藏作品</h2>
          ) : null}
          {/* Mobile: horizontal scroll with snap */}
          <div className="-mr-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pr-5 sm:hidden">
            {media.map((item) => (
              <div key={item.item_id} className="w-[calc((100%-0.75rem*2)/3.4)] shrink-0 snap-start">
                <BookmarkCard item={item} />
              </div>
            ))}
          </div>
          {/* Desktop: grid */}
          <div className="hidden grid-cols-3 gap-3 @2xl:grid-cols-4 sm:grid">
            {media.map((item) => (
              <BookmarkCard key={item.item_id} item={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bookmarks-grid.tsx
git commit -m "feat(bookmarks): add BookmarksGrid component for home page"
```

---

### Task 7: Rewrite Search Page — Remove History, Add Bookmarks

**Files:**
- Modify: `src/routes/search-page.tsx`
- Delete: `src/lib/history-utils.ts`

- [ ] **Step 1: Remove all history imports and logic from search-page.tsx**

Remove these imports:
- `batchUpsertSearchHistory`, `upsertSearchHistory`, `clearSearchHistory` from `@/lib/supabase-api`
- `searchHistoryQueryOptions` from `@/lib/supabase-queries`
- `bookHistoryStore`, `movieHistoryStore`, `personHistoryStore`, `writeRowsToLocal` from `@/lib/history-utils`
- `RecentPersonEntry` type from `@/lib/history-utils`
- `SearchHistoryRow` type from `@/types/supabase`
- `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` from tooltip components

Add these imports:
- `bookmarksQueryOptions` from `@/lib/bookmark-queries`
- `BookmarksGrid` from `@/components/bookmarks-grid`

- [ ] **Step 2: Replace history query and display with bookmarks**

Remove from `SearchPage` component:
- `historyQuery` and all `rows` / `displayBooks` / `displayMovies` / `displayPersons` derived state
- `useEffect` for `writeRowsToLocal`
- `useEffect` for localStorage→cloud migration
- `saveToHistory` helper and `historyKey`
- `handleClear` function
- The entire `{!hasHistory ? null : (...)}` history display section
- `buildPersonUrl`, `RecentMediaCard`, `RecentMediaGrid`, `PersonAvatarCard` helper components

Replace with:

```typescript
// Inside SearchPage, after query/auth setup:
const { data: bookmarks = [] } = useQuery(bookmarksQueryOptions(userId));
const hasBookmarks = bookmarks.length > 0;
```

Use `hasBookmarks` instead of `hasBookHistory` for layout conditionals:

```tsx
<main className={cn(
  "min-h-[100dvh] bg-background text-foreground",
  !hasBookmarks && "flex flex-col"
)}>
  <div className={cn(
    "relative mx-auto w-full max-w-3xl px-5 pb-20 sm:px-8",
    hasBookmarks ? "pt-6 sm:pt-10" : "my-auto"
  )}>
    <header className={cn("animate-fade-up", hasBookmarks ? "mb-10" : "mb-8 text-center")}>
      {/* ... header unchanged ... */}
    </header>

    <div ref={searchBarRef} className={cn("animate-fade-up relative [animation-delay:80ms]", hasBookmarks ? "mb-14" : "mb-6")}>
      {/* ... combobox unchanged ... */}
    </div>

    {hasBookmarks ? (
      <div className="@container animate-fade-up [animation-delay:160ms]">
        <BookmarksGrid items={bookmarks} />
      </div>
    ) : null}
  </div>
</main>
```

- [ ] **Step 3: Remove history saves from `openBookDetail` and `openMovieDetail`**

In `openBookDetail`, remove the `saveToHistory` call. Keep the navigate:

```typescript
function openBookDetail(book: SearchBook, searchQuery: string) {
  const workId = normalizeWorkId(book.key);
  if (!workId) return false;
  setIsOpen(false);
  setIsComposing(false);
  navigate(`/book/${workId}?q=${encodeURIComponent(searchQuery)}`, {
    state: { book, navDepth: 1 }
  });
  return true;
}
```

Same for `openMovieDetail`:

```typescript
function openMovieDetail(movie: SearchMovie, searchQuery: string) {
  const subjectId = movie.key;
  if (!subjectId) return false;
  setIsOpen(false);
  setIsComposing(false);
  navigate(`/movie/${subjectId}?q=${encodeURIComponent(searchQuery)}`, {
    state: { movie, navDepth: 1 }
  });
  return true;
}
```

And in `handleOptionSelect`, remove `saveToHistory` calls for author and celebrity options. Keep the navigation logic.

- [ ] **Step 4: Delete `src/lib/history-utils.ts`**

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: No TypeScript errors, successful build.

- [ ] **Step 6: Commit**

```bash
git rm src/lib/history-utils.ts src/lib/supabase-queries.ts
git add src/routes/search-page.tsx
git commit -m "feat(bookmarks): replace history with bookmarks on home page"
```

---

### Task 8: Login Migration — localStorage to Cloud

**Files:**
- Modify: `src/lib/auth-context.tsx`

- [ ] **Step 1: Add bookmark migration on auth state change**

When a user logs in and there are local bookmarks, migrate them to Supabase and clear localStorage. Add this effect inside `AuthProvider`:

```typescript
// src/lib/auth-context.tsx — add imports
import { batchUpsertBookmarks } from "@/lib/supabase-api";
import { readLocalBookmarks, clearLocalBookmarks } from "@/lib/bookmark-store";
import { useQueryClient } from "@tanstack/react-query";

// Inside AuthProvider, after existing useEffect:
const queryClient = useQueryClient();

useEffect(() => {
  const userId = session?.user?.id;
  if (!userId) return;

  const localBookmarks = readLocalBookmarks();
  if (localBookmarks.length === 0) return;

  batchUpsertBookmarks(userId, localBookmarks)
    .then(() => {
      clearLocalBookmarks();
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    })
    .catch((err) => console.error("[bookmark migration] failed:", err));
}, [session?.user?.id, queryClient]);
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth-context.tsx
git commit -m "feat(bookmarks): migrate localStorage bookmarks to cloud on login"
```

---

### Task 9: Clean Up Unused History Types and Code

**Files:**
- Modify: `src/types/supabase.ts`

- [ ] **Step 1: Remove `SearchHistoryRow` interface**

Remove the `SearchHistoryRow` interface from `src/types/supabase.ts`. Keep `Profile` and `BookmarkRow`.

```typescript
// src/types/supabase.ts — final state
export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookmarkRow {
  id: number;
  user_id: string;
  item_id: string;
  item_type: "book" | "movie" | "author" | "celebrity";
  item_title: string;
  item_cover_url: string | null;
  status: "want" | "done";
  recommendation: "up" | "down" | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Search for any remaining references to deleted modules**

Run: `grep -r "history-utils\|supabase-queries\|SearchHistoryRow\|bookHistoryStore\|movieHistoryStore\|personHistoryStore\|searchHistoryQueryOptions\|upsertSearchHistory\|batchUpsertSearchHistory\|clearSearchHistory\|getSearchHistory" src/`

Expected: No matches (all references removed in previous tasks).

- [ ] **Step 3: Verify build and run**

Run: `bun run build`
Expected: Clean build with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/supabase.ts
git commit -m "chore: remove unused SearchHistoryRow type"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Full build check**

Run: `bun run build`
Expected: Clean build, no warnings about missing modules.

- [ ] **Step 2: Manual smoke test**

Run: `bun run dev`

Verify:
1. Home page shows bookmarks grid (empty state if no bookmarks)
2. Search still works — combobox suggestions for books, movies, authors, celebrities
3. Book detail page — star button in nav, clicking toggles filled/empty star
4. Movie detail page — same star behavior
5. Author page — star button works
6. Celebrity page — star button works
7. Collection page — no star button, no UserMenu
8. Home page — UserMenu shows on right side
9. Logged out: bookmarks persist in localStorage across page reloads
10. Log in: local bookmarks migrate to cloud, localStorage cleared

- [ ] **Step 3: Final commit if any fixes needed**
