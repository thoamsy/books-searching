# Favorites Feature Design

Replace browsing history with a bookmark/favorites system. Users can star books and movies from detail pages; starred items appear as a grid on the home page.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| History vs Favorites | Remove history entirely | Two features serve similar purpose; favorites is more intentional |
| Bookmark status | Always `"want"`, no state picker | Keep it simple, iterate later |
| Un-bookmark | Hard delete row | No business need to retain cancelled bookmarks |
| Logged-out experience | localStorage, migrate on login | Seamless UX, no login gate on starring |
| Home grid | Books + movies mixed, `created_at` desc | Single stream, no category tabs |
| Home copy | Keep "找到你的下一部作品" | Brand slogan, not tied to content area |
| localStorage limit | None | Sufficient capacity for bookmarks |

## Data Layer

### Supabase Table: `bookmarks`

Uses the existing `BookmarkRow` type. Active fields:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → auth.users | |
| `item_id` | text | workId or subjectId |
| `item_type` | `"book"` \| `"movie"` | |
| `item_title` | text | For display without re-fetching |
| `item_cover_url` | text | For display without re-fetching |
| `status` | text | Always `"want"` for now |
| `created_at` | timestamptz | Sort key |

Unused fields (`recommendation`, `updated_at`) are left in the schema but not written to.

### localStorage (Logged-Out)

Key: `bookmarks`. Value: `Array<{item_id, item_type, item_title, item_cover_url, created_at}>`. No size limit.

### Login Migration

On successful login, if localStorage `bookmarks` is non-empty:
1. Batch upsert all local bookmarks to Supabase (upsert on `user_id + item_id` to avoid duplicates)
2. Clear localStorage `bookmarks`
3. Invalidate the bookmarks query to refresh from cloud

### TanStack Query

- `bookmarksQueryOptions()` — logged in: fetch from Supabase ordered by `created_at` desc. Logged out: read from localStorage.
- `useAddBookmark(item_id, item_type)` mutation — logged in: insert row. Logged out: append to localStorage. Mutation reads `item_title` and `item_cover_url` from the detail page's query cache.
- `useRemoveBookmark(item_id)` mutation — logged in: delete row. Logged out: filter from localStorage.
- Both mutations use optimistic updates on the bookmarks list query.

## Nav Layout

### RootLayout `<nav>` Right Side

| Route | Left | Right |
|-------|------|-------|
| `/` (home) | empty | `<UserMenu />` |
| `/book/:workId` | `<BackButton />` | `<BookmarkButton />` |
| `/movie/:subjectId` | `<BackButton />` | `<BookmarkButton />` |
| `/author/:authorName` | `<BackButton />` | empty |
| `/celebrity/:celebrityId` | `<BackButton />` | empty |
| `/collection/:collectionId` | `<BackButton />` | empty |

Implementation: RootLayout reads `useLocation()` to determine which right-side component to render. BookmarkButton extracts `item_id` and `item_type` from route params.

## BookmarkButton Component

- Icon: `Star` from lucide-react
- Un-bookmarked: outline star
- Bookmarked: filled star with `text-star` color
- Reads `item_id` + `item_type` from route params
- Checks bookmark status against the bookmarks query cache
- On click: toggle via add/remove mutation with optimistic update
- On mutation, `item_title` and `item_cover_url` are read from the detail page's query cache (already loaded since user is on the detail page)

## Home Page Changes

### Remove

- `bookHistoryStore`, `movieHistoryStore`, `personHistoryStore` and all related code
- History display sections on search page
- `search_history` Supabase sync logic (`batchUpsertSearchHistory`, etc.)
- History-related imports and hooks

### Add

- Bookmarks grid below the search bar
- Uses existing `MediaCard` style (cover + title), clicking navigates to detail page
- Books and movies mixed, ordered by `created_at` desc
- Empty state: short message encouraging the user to star their first item
- Layout: same card grid pattern currently used by history, responsive columns

### Keep

- Brand header ("找到你的下一部作品")
- Search bar (combobox)
- All search functionality unchanged
