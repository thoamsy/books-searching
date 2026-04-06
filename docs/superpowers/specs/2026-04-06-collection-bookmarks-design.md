# Collection Bookmarks

Save and display Douban curated collections (榜单) alongside existing book/movie/author/celebrity bookmarks.

## Decisions

- **Storage granularity:** Store collection metadata only (id, title). Items are fetched live from the Douban API when the user opens a collection.
- **Database approach:** Reuse existing `bookmarks` table with `item_type = 'collection'`. No new table.
- **Cover images:** Store 4 thumbnail URLs (`pic.normal`) in a new `item_cover_urls text[]` column. Frontend renders a 2x2 CSS grid — no image compositing.

## Database Changes

### Migration

1. Alter `item_type` CHECK constraint to allow `'book'`, `'movie'`, `'author'`, `'celebrity'`, `'collection'`.
2. Add column `item_cover_urls text[]` (nullable, default null). Only used by `collection` type.

```sql
alter table public.bookmarks
  drop constraint bookmarks_item_type_check,
  add constraint bookmarks_item_type_check
    check (item_type in ('book', 'movie', 'author', 'celebrity', 'collection'));

alter table public.bookmarks
  add column item_cover_urls text[];
```

### Bookmark Row (collection)

| Field | Value |
|---|---|
| `item_id` | collection ID (e.g. `"movie_weekly_best"`) |
| `item_type` | `"collection"` |
| `item_title` | collection title (e.g. `"一周口碑电影榜"`) |
| `item_cover_url` | null |
| `item_cover_urls` | first 4 items' `pic.normal` URLs |
| `status` | `"want"` (default) |

## Frontend Changes

### TypeScript Types

- `BookmarkItem`: add `item_cover_urls?: string[]` field.
- `LocalBookmark`: same addition for localStorage fallback.
- Extend `item_type` union: add `"collection"`.

### BookmarkButton (collection page)

- Detect `/collection/:collectionId` route in `useParams`.
- Read collection metadata from the infinite query cache (`queryClient.getQueryData`).
- Extract first 4 items' cover URLs (use `pic.normal` size — requires exposing `normalCoverUrl` from `mapItem` or a parallel extraction).
- On add: pass `item_cover_urls` array to `addBookmark` mutation.
- On remove: same as other types — `removeBookmark(itemId)`.

### Collection Cover Component

New `CollectionCover` component: a 2x2 CSS grid of 4 thumbnail images.

```
+--------+--------+
| img[0] | img[1] |
+--------+--------+
| img[2] | img[3] |
+--------+--------+
```

- Outer: `aspect-square rounded-lg overflow-hidden`
- Inner: `grid grid-cols-2 grid-rows-2` with no gap
- Each cell: `<img>` with `object-cover`
- Fewer than 4 images: fill empty slots with `bg-accent` placeholder

### Homepage Layout

**Desktop (lg+), when collection bookmarks exist:**

Current single-column `max-w-3xl` becomes a two-column layout:

```
+------ max-w-5xl (or similar) ------+
|                        |           |
|  Search bar            |  收藏榜单  |
|  Books / Movies /      |  (aside)  |
|  Persons               |  sticky   |
|                        |           |
+------------------------+-----------+
```

- Main column: existing search + BookmarksGrid (unchanged).
- Aside: collection bookmarks displayed as a vertical list of `CollectionCover` cards with titles.
- Aside is `lg:sticky lg:top-4`.
- When no collection bookmarks exist, layout stays single-column — no empty aside.

**Mobile:**

New section at the bottom of BookmarksGrid: "收藏榜单". Horizontal snap-scroll carousel of square `CollectionCover` cards, same interaction pattern as books/movies sections.

### Stale Cover Refresh

Cover URLs are written at bookmark creation time but collection rankings change over time. To keep covers fresh:

- When the user visits a bookmarked collection page, compare the current top-4 `pic.normal` URLs against the stored `item_cover_urls`.
- If they differ, silently upsert the bookmark with the new URLs.
- No user interaction required — this is a background side effect of viewing the page.

### Supabase API

- `addBookmark`: include `item_cover_urls` in upsert payload.
- `getBookmarks`: ensure `item_cover_urls` is selected and returned.
- `updateBookmarkCovers(userId, itemId, coverUrls)`: new function to patch `item_cover_urls` only. Used by the stale cover refresh logic.
- No changes to `removeBookmark`.

### LocalStorage Fallback

- `LocalBookmark` type gains `item_cover_urls?: string[]`.
- Read/write logic unchanged — the field serializes naturally with JSON.

### Collection API

Need to expose `pic.normal` URL for collection items. Two options:
- Add `normalCoverUrl` to `CollectionItem` type and populate in `mapItem`.
- Or extract directly from the raw infinite query data in the BookmarkButton.

Prefer adding `normalCoverUrl` to `CollectionItem` — cleaner, reusable.

## Scope Exclusions

- No offline caching of collection content.
- Cover URLs are refreshed on visit only, not on a background schedule.
- `status` and `recommendation` fields are unused for collections (default `"want"`, null).
- No new filtering/tabs on the homepage — collection section appears alongside existing sections.
