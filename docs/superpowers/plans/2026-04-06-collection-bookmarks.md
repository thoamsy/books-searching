# Collection Bookmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users bookmark Douban curated collections and display them on the homepage with 2x2 cover grids.

**Architecture:** Reuse the existing `bookmarks` table by adding `item_type = 'collection'` and a `item_cover_urls text[]` column for thumbnail URLs. The frontend renders covers as a CSS grid, not composited images. The homepage gains a conditional aside for desktop and a new carousel section for mobile.

**Tech Stack:** Supabase (Postgres), React 19, React Router, TanStack Query, Tailwind CSS 4, shadcn/ui, Framer Motion

**Spec:** `docs/superpowers/specs/2026-04-06-collection-bookmarks-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `supabase/migration.sql` | Add migration SQL for `item_type` CHECK + `item_cover_urls` column |
| Modify | `src/types/supabase.ts` | Add `"collection"` to `item_type` union, add `item_cover_urls` field |
| Modify | `src/types/collection.ts` | Add `normalCoverUrl` to `CollectionItem` |
| Modify | `src/lib/collection-api.ts` | Populate `normalCoverUrl` from `pic.normal` in `mapItem` |
| Modify | `src/lib/supabase-api.ts` | Extend `addBookmark` for `item_cover_urls`, add `updateBookmarkCovers` |
| Modify | `src/lib/bookmark-store.ts` | Add `item_cover_urls` to `LocalBookmark` |
| Modify | `src/lib/bookmark-queries.ts` | Add `item_cover_urls` to `BookmarkItem`, pass through in queries/mutations |
| Modify | `src/components/bookmark-button.tsx` | Handle collection route, extract cover URLs, pass to mutation |
| Create | `src/components/collection-cover.tsx` | 2x2 CSS grid thumbnail component |
| Modify | `src/components/bookmarks-grid.tsx` | Add mobile collection section with carousel |
| Modify | `src/routes/search-page.tsx` | Conditional two-column layout on desktop with collection aside |
| Modify | `src/routes/collection-page.tsx` | Stale cover refresh side effect |
| Modify | `src/router.tsx` | Show BookmarkButton on `/collection/` routes |

---

### Task 1: Database Migration + Types

**Files:**
- Modify: `supabase/migration.sql` (append new migration)
- Modify: `src/types/supabase.ts`

- [ ] **Step 1: Add migration SQL**

Append to `supabase/migration.sql`:

```sql
-- Collection bookmarks: expand item_type, add cover URLs array
alter table public.bookmarks
  drop constraint bookmarks_item_type_check,
  add constraint bookmarks_item_type_check
    check (item_type in ('book', 'movie', 'author', 'celebrity', 'collection'));

alter table public.bookmarks
  add column if not exists item_cover_urls text[];
```

- [ ] **Step 2: Run migration against Supabase**

```bash
bunx supabase db push
```

If using remote Supabase, run the SQL directly in the Supabase dashboard SQL editor instead.

- [ ] **Step 3: Update BookmarkRow type**

In `src/types/supabase.ts`, update `BookmarkRow`:

```typescript
export interface BookmarkRow {
  id: number;
  user_id: string;
  item_id: string;
  item_type: "book" | "movie" | "author" | "celebrity" | "collection";
  item_title: string;
  item_cover_url: string | null;
  item_cover_urls: string[] | null;
  status: "want" | "done";
  recommendation: "up" | "down" | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migration.sql src/types/supabase.ts
git commit -m "feat(db): add collection item_type and item_cover_urls column"
```

---

### Task 2: Collection API — Expose `normalCoverUrl`

**Files:**
- Modify: `src/types/collection.ts`
- Modify: `src/lib/collection-api.ts`

- [ ] **Step 1: Add `normalCoverUrl` to `CollectionItem` type**

In `src/types/collection.ts`, add the field to `CollectionItem`:

```typescript
export interface CollectionItem {
  id: string;
  title: string;
  type: "book" | "movie" | "tv";
  rank?: number;
  coverUrl?: string;
  normalCoverUrl?: string;  // <-- add this
  rating?: {
    value: number;
    count: number;
  };
  cardSubtitle?: string;
  info?: string;
  year?: string;
  honorInfos?: { rank: number; title: string }[];
}
```

- [ ] **Step 2: Populate `normalCoverUrl` in `mapItem`**

In `src/lib/collection-api.ts`, update the `mapItem` function:

```typescript
function mapItem(raw: RexxarCollectionItem): CollectionItem {
  const coverUrl = raw.pic?.large ?? raw.pic?.normal ?? raw.cover?.url;
  const normalCoverUrl = raw.pic?.normal ?? raw.cover?.url;
  return {
    id: raw.id,
    title: raw.title,
    type: (raw.type as CollectionItem["type"]) ?? "book",
    rank: raw.rank ?? raw.rank_value,
    coverUrl: proxifyImageUrl(coverUrl),
    normalCoverUrl: proxifyImageUrl(normalCoverUrl),
    rating:
      raw.rating?.value != null
        ? { value: raw.rating.value, count: raw.rating.count ?? 0 }
        : undefined,
    cardSubtitle: raw.card_subtitle,
    info: raw.info,
    year: raw.year,
    honorInfos: raw.honor_infos
  };
}
```

- [ ] **Step 3: Verify build**

```bash
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add src/types/collection.ts src/lib/collection-api.ts
git commit -m "feat(collection): expose normalCoverUrl from API response"
```

---

### Task 3: Bookmark Data Layer — Support `item_cover_urls`

**Files:**
- Modify: `src/lib/supabase-api.ts`
- Modify: `src/lib/bookmark-store.ts`
- Modify: `src/lib/bookmark-queries.ts`

- [ ] **Step 1: Extend `addBookmark` in `supabase-api.ts`**

Update the `addBookmark` function to accept and upsert `item_cover_urls`:

```typescript
export async function addBookmark(
  userId: string,
  bookmark: Pick<BookmarkRow, "item_id" | "item_type" | "item_title" | "item_cover_url"> & {
    item_cover_urls?: string[] | null;
  }
) {
  const { error } = await supabase.from("bookmarks").upsert(
    {
      user_id: userId,
      item_id: bookmark.item_id,
      item_type: bookmark.item_type,
      item_title: bookmark.item_title,
      item_cover_url: bookmark.item_cover_url,
      item_cover_urls: bookmark.item_cover_urls ?? null,
      status: "want",
    },
    { onConflict: "user_id,item_id,item_type" }
  );
  if (error) throw error;
}
```

- [ ] **Step 2: Add `updateBookmarkCovers` function**

Add to `src/lib/supabase-api.ts`:

```typescript
export async function updateBookmarkCovers(
  userId: string,
  itemId: string,
  coverUrls: string[]
) {
  const { error } = await supabase
    .from("bookmarks")
    .update({ item_cover_urls: coverUrls })
    .eq("user_id", userId)
    .eq("item_id", itemId);
  if (error) throw error;
}
```

- [ ] **Step 3: Extend `batchUpsertBookmarks` for `item_cover_urls`**

Update `batchUpsertBookmarks` in `src/lib/supabase-api.ts`:

```typescript
export async function batchUpsertBookmarks(
  userId: string,
  bookmarks: Array<Pick<BookmarkRow, "item_id" | "item_type" | "item_title" | "item_cover_url"> & {
    item_cover_urls?: string[] | null;
  }>
) {
  if (bookmarks.length === 0) return;
  const rows = bookmarks.map((b) => ({
    user_id: userId,
    item_id: b.item_id,
    item_type: b.item_type,
    item_title: b.item_title,
    item_cover_url: b.item_cover_url,
    item_cover_urls: b.item_cover_urls ?? null,
    status: "want" as const,
  }));
  const { error } = await supabase
    .from("bookmarks")
    .upsert(rows, { onConflict: "user_id,item_id,item_type" });
  if (error) throw error;
}
```

- [ ] **Step 4: Extend `LocalBookmark` in `bookmark-store.ts`**

In `src/lib/bookmark-store.ts`, update the type:

```typescript
export type LocalBookmark = Pick<BookmarkRow, "item_id" | "item_type" | "item_title" | "item_cover_url"> & {
  item_cover_urls?: string[] | null;
  created_at: string;
};
```

No other changes needed — `item_cover_urls` serializes with JSON automatically.

- [ ] **Step 5: Extend `BookmarkItem` in `bookmark-queries.ts`**

In `src/lib/bookmark-queries.ts`, update `BookmarkItem` and the query mapping:

```typescript
export type BookmarkItem = Pick<BookmarkRow, "item_id" | "item_type" | "item_title" | "item_cover_url" | "item_cover_urls"> & {
  created_at: string;
};
```

Update the `queryFn` mapping inside `bookmarksQueryOptions` to include `item_cover_urls`:

```typescript
queryFn: userId
  ? async (): Promise<BookmarkItem[]> => {
      const rows = await getBookmarks(userId);
      return rows.map((r) => ({
        item_id: r.item_id,
        item_type: r.item_type,
        item_title: r.item_title,
        item_cover_url: r.item_cover_url,
        item_cover_urls: r.item_cover_urls,
        created_at: r.created_at,
      }));
    }
  : (): Promise<BookmarkItem[]> => Promise.resolve(readLocalBookmarks()),
```

- [ ] **Step 6: Verify build**

```bash
bun run build
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase-api.ts src/lib/bookmark-store.ts src/lib/bookmark-queries.ts
git commit -m "feat(bookmarks): support item_cover_urls in data layer"
```

---

### Task 4: BookmarkButton — Handle Collection Route

**Files:**
- Modify: `src/components/bookmark-button.tsx`
- Modify: `src/router.tsx`

- [ ] **Step 1: Enable BookmarkButton on collection routes**

In `src/router.tsx`, update `isDetailWithBookmark` to match collection:

```typescript
const isDetailWithBookmark =
  /^\/(book|movie)\//.test(pathname) ||
  /^\/celebrity\//.test(pathname) ||
  /^\/author\//.test(pathname) ||
  /^\/collection\//.test(pathname);
```

- [ ] **Step 2: Add collection to `useBookmarkContext`**

In `src/components/bookmark-button.tsx`, add collection detection in `useBookmarkContext`:

```typescript
function useBookmarkContext(): { itemId: string; itemType: BookmarkType } | null {
  const params = useParams();

  if (params.workId) return { itemId: params.workId, itemType: "book" };
  if (params.subjectId) return { itemId: params.subjectId, itemType: "movie" };
  if (params.celebrityId) return { itemId: params.celebrityId, itemType: "celebrity" };
  if (params.authorName) return { itemId: decodeURIComponent(params.authorName), itemType: "author" };
  if (params.collectionId) return { itemId: params.collectionId, itemType: "collection" };

  return null;
}
```

- [ ] **Step 3: Add collection metadata extraction in `useItemMeta`**

Add a new hook import and collection query at the top of `bookmark-button.tsx`:

```typescript
import { collectionItemsQueryOptions } from "@/lib/collection-queries";
import { useQueryClient } from "@tanstack/react-query";
```

Then update `useItemMeta` to handle collections. Collection data comes from the infinite query cache (already loaded by the collection page), so we read it directly from the query client:

```typescript
function useItemMeta(itemId: string, itemType: BookmarkType) {
  const queryClient = useQueryClient();

  const bookQuery = useQuery({
    ...bookDetailQueryOptions(itemType === "book" ? itemId : ""),
    enabled: itemType === "book",
  });
  const movieQuery = useQuery({
    ...movieDetailQueryOptions(itemType === "movie" ? itemId : ""),
    enabled: itemType === "movie",
  });
  const celebrityQuery = useQuery({
    ...celebrityDetailQueryOptions(itemType === "celebrity" ? itemId : ""),
    enabled: itemType === "celebrity",
  });

  if (itemType === "book") {
    const detail = bookQuery.data;
    if (!detail) return null;
    return { title: detail.title, coverUrl: detail.coverUrl ?? null };
  }

  if (itemType === "movie") {
    const detail = movieQuery.data;
    if (!detail) return null;
    return { title: detail.title, coverUrl: detail.coverUrl ?? null };
  }

  if (itemType === "celebrity") {
    const detail = celebrityQuery.data;
    if (!detail) return null;
    return { title: detail.name, coverUrl: detail.coverUrl ?? null };
  }

  if (itemType === "author") {
    const params = new URLSearchParams(window.location.search);
    return { title: itemId, coverUrl: params.get("photo") };
  }

  if (itemType === "collection") {
    const queryKey = collectionItemsQueryOptions(itemId).queryKey;
    const cachedData = queryClient.getQueryData<{
      pages: Array<{ meta: { title: string }; items: Array<{ normalCoverUrl?: string }> }>;
    }>(queryKey);
    if (!cachedData?.pages?.[0]) return null;
    const { meta, items } = cachedData.pages[0];
    const coverUrls = items
      .slice(0, 4)
      .map((item) => item.normalCoverUrl)
      .filter((url): url is string => Boolean(url));
    return { title: meta.title, coverUrl: null, coverUrls };
  }

  return null;
}
```

- [ ] **Step 4: Update `handleToggle` for collection bookmarks**

In `BookmarkButton`, update the toggle to pass `item_cover_urls`:

```typescript
function handleToggle() {
  if (isBookmarked) {
    removeMutation.mutate(itemId);
  } else {
    addMutation.mutate({
      item_id: itemId,
      item_type: itemType,
      item_title: title,
      item_cover_url: coverUrl,
      item_cover_urls: meta?.coverUrls ?? null,
      created_at: new Date().toISOString(),
    });
    void animateStar(
      starRef.current,
      { scale: [1, 1.3, 0.9, 1.05, 1], rotate: [0, -14, 10, -4, 0] },
      { duration: 0.45, ease: [0.2, 1, 0.3, 1] },
    );
  }
}
```

Note: the `meta` return type from `useItemMeta` now includes an optional `coverUrls` field. Update the function's return values to include `coverUrls?: string[]` in the return type consistently. The existing returns should have `coverUrls: undefined` implicitly, which is fine.

- [ ] **Step 5: Verify build**

```bash
bun run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/bookmark-button.tsx src/router.tsx
git commit -m "feat(bookmark): support collection bookmarking from collection page"
```

---

### Task 5: CollectionCover Component

**Files:**
- Create: `src/components/collection-cover.tsx`

- [ ] **Step 1: Create the 2x2 grid cover component**

Create `src/components/collection-cover.tsx`:

```tsx
import { cn } from "@/lib/utils";

export function CollectionCover({
  urls,
  title,
  className,
}: {
  urls: string[];
  title: string;
  className?: string;
}) {
  // Pad to 4 slots
  const slots = Array.from({ length: 4 }, (_, i) => urls[i] ?? null);

  return (
    <div
      className={cn(
        "aspect-square overflow-hidden rounded-lg border border-white/60 shadow-warm-sm",
        className
      )}
    >
      <div className="grid h-full w-full grid-cols-2 grid-rows-2">
        {slots.map((url, i) =>
          url ? (
            <img
              key={i}
              src={url}
              alt={`${title} cover ${i + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div key={i} className="h-full w-full bg-accent" />
          )
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
bun run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/collection-cover.tsx
git commit -m "feat: add CollectionCover 2x2 grid component"
```

---

### Task 6: Homepage — Mobile Collection Section in BookmarksGrid

**Files:**
- Modify: `src/components/bookmarks-grid.tsx`

- [ ] **Step 1: Add collection section to BookmarksGrid**

In `src/components/bookmarks-grid.tsx`, add imports:

```typescript
import { CollectionCover } from "@/components/collection-cover";
```

Then add a `collections` filter alongside the existing `persons`, `books`, `movies`:

```typescript
const collections = items.filter((i) => i.item_type === "collection");
```

Add a new section at the bottom of the returned JSX (after the movies section, before the closing `</div>`):

```tsx
{collections.length > 0 ? (
  <section className="flex flex-col gap-5">
    <h2 className="text-xs uppercase tracking-[0.28em] text-muted-foreground">收藏榜单</h2>
    {/* Mobile: horizontal scroll */}
    <div className="-mr-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pr-5 lg:hidden">
      {collections.map((item) => (
        <div key={item.item_id} className="w-[calc((100%-0.75rem*2)/3.4)] shrink-0 snap-start">
          <DepthLink to={`/collection/${item.item_id}`} className="group">
            <CollectionCover
              urls={item.item_cover_urls ?? []}
              title={item.item_title}
              className="transition-shadow group-hover:shadow-warm-md"
            />
            <div className="mt-2 px-0.5">
              <p className="truncate text-sm font-normal text-foreground">{item.item_title}</p>
            </div>
          </DepthLink>
        </div>
      ))}
    </div>
    {/* Desktop: hidden here, shown in aside */}
  </section>
) : null}
```

- [ ] **Step 2: Verify build**

```bash
bun run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/bookmarks-grid.tsx
git commit -m "feat(home): add mobile collection carousel to BookmarksGrid"
```

---

### Task 7: Homepage — Desktop Aside Layout

**Files:**
- Modify: `src/routes/search-page.tsx`

This task changes the homepage layout on desktop (lg+) to show a sticky aside with collection bookmarks when they exist. The existing single-column `max-w-3xl` layout is preserved when there are no collection bookmarks.

- [ ] **Step 1: Add imports and extract collection bookmarks**

At the top of `search-page.tsx`, add:

```typescript
import { CollectionCover } from "@/components/collection-cover";
import { DepthLink } from "@/components/depth-link";
```

Inside `SearchPage`, after the existing `hasBookmarks` line, add:

```typescript
const collectionBookmarks = bookmarks.filter((b) => b.item_type === "collection");
const hasCollections = collectionBookmarks.length > 0;
```

- [ ] **Step 2: Wrap the main content in a two-column layout**

The current `<main>` contains a single `motion.div` with `max-w-3xl`. Wrap it in a conditional two-column grid for desktop.

Replace the `<main>` opening and the outer `motion.div`:

```tsx
return (
  <main className="flex flex-1 flex-col">
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8",
        hasCollections
          ? "max-w-5xl lg:grid lg:grid-cols-[1fr_200px] lg:items-start lg:gap-8"
          : "max-w-3xl"
      )}
    >
      <motion.div
        layout={isPop ? false : "position"}
        transition={layoutTransition}
        className={cn(
          "relative w-full",
          hasBookmarks ? "pt-6 pb-20 sm:pt-10" : "my-auto"
        )}
      >
        {/* ... existing header, search bar, AnimatePresence for bookmarks ... */}
      </motion.div>

      {/* Desktop aside for collection bookmarks */}
      {hasCollections ? (
        <aside className="hidden pt-6 sm:pt-10 lg:sticky lg:top-4 lg:block">
          <h2 className="text-xs uppercase tracking-[0.28em] text-muted-foreground">收藏榜单</h2>
          <div className="mt-5 flex flex-col gap-4">
            {collectionBookmarks.map((item) => (
              <DepthLink key={item.item_id} to={`/collection/${item.item_id}`} className="group">
                <CollectionCover
                  urls={item.item_cover_urls ?? []}
                  title={item.item_title}
                  className="transition-shadow group-hover:shadow-warm-md"
                />
                <p className="mt-2 truncate text-sm text-foreground">{item.item_title}</p>
              </DepthLink>
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  </main>
);
```

Key changes:
- New `<div>` wrapper with conditional `lg:grid lg:grid-cols-[1fr_200px]` when collections exist
- `max-w-3xl` moves to the wrapper (becomes `max-w-5xl` when two-column)
- The `motion.div` drops `mx-auto` and `max-w-3xl` (now handled by parent)
- Desktop aside is `hidden lg:block` with sticky positioning

- [ ] **Step 3: Verify build and test**

```bash
bun run build
```

Test manually:
1. Without collection bookmarks: homepage should look identical to before
2. With collection bookmarks: desktop shows aside on right, mobile shows carousel in BookmarksGrid

- [ ] **Step 4: Commit**

```bash
git add src/routes/search-page.tsx
git commit -m "feat(home): add desktop aside for collection bookmarks"
```

---

### Task 8: Stale Cover Refresh on Collection Visit

**Files:**
- Modify: `src/routes/collection-page.tsx`
- Modify: `src/lib/bookmark-queries.ts`

- [ ] **Step 1: Add `useUpdateBookmarkCovers` mutation**

In `src/lib/bookmark-queries.ts`, add:

```typescript
import { updateBookmarkCovers } from "@/lib/supabase-api";

export function useUpdateBookmarkCovers() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const key = bookmarksQueryKey(userId);

  return useMutation({
    mutationFn: async ({ itemId, coverUrls }: { itemId: string; coverUrls: string[] }) => {
      if (!userId) return;
      await updateBookmarkCovers(userId, itemId, coverUrls);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
```

- [ ] **Step 2: Add refresh side effect in `CollectionContent`**

In `src/routes/collection-page.tsx`, add imports:

```typescript
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  bookmarksQueryOptions,
  useUpdateBookmarkCovers,
} from "@/lib/bookmark-queries";
```

Inside `CollectionContent`, after the existing `items` memo, add:

```typescript
const { user } = useAuth();
const userId = user?.id ?? null;
const { data: bookmarks = [] } = useQuery(bookmarksQueryOptions(userId));
const updateCovers = useUpdateBookmarkCovers();

// Refresh stale cover URLs when visiting a bookmarked collection
useEffect(() => {
  const bookmark = bookmarks.find(
    (b) => b.item_id === collectionId && b.item_type === "collection"
  );
  if (!bookmark || items.length === 0) return;

  const currentUrls = items
    .slice(0, 4)
    .map((item) => item.normalCoverUrl)
    .filter((url): url is string => Boolean(url));

  const storedUrls = bookmark.item_cover_urls ?? [];
  const isDifferent =
    currentUrls.length !== storedUrls.length ||
    currentUrls.some((url, i) => url !== storedUrls[i]);

  if (isDifferent && currentUrls.length > 0) {
    updateCovers.mutate({ itemId: collectionId, coverUrls: currentUrls });
  }
}, [collectionId, bookmarks, items, updateCovers]);
```

Note: add `normalCoverUrl` to the `CollectionItem` import in the `useMemo` dependency — it's already available since Task 2.

- [ ] **Step 3: Verify build**

```bash
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/bookmark-queries.ts src/routes/collection-page.tsx
git commit -m "feat(collection): refresh stale cover URLs on page visit"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Full build check**

```bash
bun run build
```

- [ ] **Step 2: Manual test checklist**

1. Open a collection page → star icon appears in nav
2. Click star → collection is bookmarked, star fills
3. Go home → desktop: collection appears in right aside with 2x2 cover; mobile: appears in carousel
4. Click collection card → navigates back to collection page
5. Click star again → collection is removed from bookmarks
6. Go home → aside disappears, layout returns to single-column
7. Re-bookmark a collection → visit it again after items have changed → cover should silently update

- [ ] **Step 3: Commit any final fixes, then push**

```bash
git push
```
