# Collection Page (豆瓣榜单) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collection page that displays Douban subject collections (e.g. 豆瓣2025年度图书), and make the existing "上榜" badges in book detail pages clickable links to these collection pages.

**Architecture:** New Rexxar API proxy in vite.config.ts → new API functions in `collection-api.ts` → new TanStack Query options → new `/collection/:collectionId` route page. The collection page displays the collection metadata (title, subtitle, follower count) and a paginated grid of items (books/movies). The existing `SubjectCollection` badges in book-detail-page become `<Link>` elements.

**Tech Stack:** React, React Router, TanStack Query, Tailwind CSS (existing stack — no new dependencies)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/collection-api.ts` | Fetch collection metadata & items from Rexxar API |
| Create | `src/lib/collection-queries.ts` | TanStack Query options for collection data |
| Create | `src/types/collection.ts` | TypeScript types for collection API responses |
| Create | `src/routes/collection-page.tsx` | Collection page component |
| Modify | `vite.config.ts` | Add Rexxar API proxy for collections |
| Modify | `src/router.tsx` | Add `/collection/:collectionId` route |
| Modify | `src/routes/book-detail-page.tsx` | Make "上榜" badges clickable links |

---

### Task 1: Add Rexxar Collection API Proxy

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add the Rexxar collection proxy middleware**

Add a new Vite plugin **after** the existing `douban-celebrity-proxy` plugin (before `react()`). This proxy handles two endpoints:
- `/api/douban/collection/:id` → collection metadata
- `/api/douban/collection/:id/items` → collection items (with pagination)

Both use the Rexxar API at `m.douban.com` which requires a `Referer` header set to `https://m.douban.com/`.

```typescript
{
  name: "douban-collection-proxy",
  configureServer(server) {
    const REXXAR_HEADERS = {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      Referer: "https://m.douban.com/"
    };

    // Items endpoint (must come before metadata catch-all)
    server.middlewares.use(async (req, res, next) => {
      const match = req.url?.match(
        /^\/api\/douban\/collection\/([A-Za-z0-9_]+)\/items\/?(\?.*)?$/
      );
      if (!match) return next();

      const collectionId = match[1];
      const search = match[2] ?? "";
      const params = new URLSearchParams(search);
      const start = params.get("start") ?? "0";
      const count = params.get("count") ?? "20";

      try {
        const upstream = await fetch(
          `https://m.douban.com/rexxar/api/v2/subject_collection/${collectionId}/items?start=${start}&count=${count}`,
          { headers: REXXAR_HEADERS }
        );
        const body = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader(
          "Content-Type",
          upstream.headers.get("content-type") ?? "application/json"
        );
        res.setHeader("Cache-Control", "public, max-age=300");
        res.end(body);
      } catch {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: "proxy error" }));
      }
    });

    // Metadata endpoint
    server.middlewares.use(async (req, res, next) => {
      const match = req.url?.match(
        /^\/api\/douban\/collection\/([A-Za-z0-9_]+)\/?$/
      );
      if (!match) return next();

      const collectionId = match[1];

      try {
        const upstream = await fetch(
          `https://m.douban.com/rexxar/api/v2/subject_collection/${collectionId}`,
          { headers: REXXAR_HEADERS }
        );
        const body = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader(
          "Content-Type",
          upstream.headers.get("content-type") ?? "application/json"
        );
        res.setHeader("Cache-Control", "public, max-age=300");
        res.end(body);
      } catch {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: "proxy error" }));
      }
    });
  }
},
```

- [ ] **Step 2: Verify the proxy works**

Run: `npm run dev` (or the project's dev command), then:
```bash
curl -s http://localhost:5173/api/douban/collection/ECZZABULI | head -c 200
curl -s "http://localhost:5173/api/douban/collection/ECZZABULI/items?start=0&count=5" | head -c 200
```
Expected: JSON responses with collection metadata and items respectively.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: add Rexxar collection API proxy"
```

---

### Task 2: Define Collection Types

**Files:**
- Create: `src/types/collection.ts`

- [ ] **Step 1: Create collection types**

```typescript
export interface CollectionMeta {
  id: string;
  name: string;
  title: string;
  subtitle?: string;
  subjectType: "book" | "movie" | "tv" | "music";
  total: number;
  followersCount?: number;
  updatedAt?: string;
  backgroundColorScheme?: {
    isDark: boolean;
    primaryColorLight?: string;
    primaryColorDark?: string;
  };
}

export interface CollectionItem {
  id: string;
  title: string;
  type: "book" | "movie" | "tv";
  rank?: number;
  coverUrl?: string;
  rating?: {
    value: number;
    count: number;
  };
  cardSubtitle?: string;
  info?: string;
  year?: string;
  honorInfos?: { rank: number; title: string }[];
}

export interface CollectionItemsResponse {
  total: number;
  start: number;
  count: number;
  meta: CollectionMeta;
  items: CollectionItem[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/collection.ts
git commit -m "feat: add collection TypeScript types"
```

---

### Task 3: Create Collection API Functions

**Files:**
- Create: `src/lib/collection-api.ts`

- [ ] **Step 1: Create the API module**

```typescript
import type {
  CollectionItem,
  CollectionItemsResponse,
  CollectionMeta
} from "@/types/collection";

function proxifyImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return `/api/douban/image?url=${encodeURIComponent(url)}`;
}

interface RexxarCollectionMeta {
  id: string;
  name: string;
  title: string;
  subtitle?: string;
  subject_type?: string;
  total?: number;
  followers_count?: number;
  updated_at?: string;
  background_color_scheme?: {
    is_dark?: boolean;
    primary_color_light?: string;
    primary_color_dark?: string;
  };
}

interface RexxarCollectionItem {
  id: string;
  title: string;
  type: string;
  rank?: number;
  rank_value?: number;
  rating?: { value?: number; count?: number };
  pic?: { large?: string; normal?: string };
  cover?: { url?: string };
  card_subtitle?: string;
  info?: string;
  year?: string;
  honor_infos?: { rank: number; title: string }[];
}

interface RexxarItemsResponse {
  total: number;
  start: number;
  count: number;
  subject_collection: RexxarCollectionMeta;
  subject_collection_items: RexxarCollectionItem[];
}

function mapMeta(raw: RexxarCollectionMeta): CollectionMeta {
  return {
    id: raw.id,
    name: raw.name,
    title: raw.title,
    subtitle: raw.subtitle,
    subjectType: (raw.subject_type as CollectionMeta["subjectType"]) ?? "book",
    total: raw.total ?? 0,
    followersCount: raw.followers_count,
    updatedAt: raw.updated_at,
    backgroundColorScheme: raw.background_color_scheme
      ? {
          isDark: raw.background_color_scheme.is_dark ?? false,
          primaryColorLight: raw.background_color_scheme.primary_color_light,
          primaryColorDark: raw.background_color_scheme.primary_color_dark
        }
      : undefined
  };
}

function mapItem(raw: RexxarCollectionItem): CollectionItem {
  const coverUrl = raw.pic?.large ?? raw.pic?.normal ?? raw.cover?.url;
  return {
    id: raw.id,
    title: raw.title,
    type: (raw.type as CollectionItem["type"]) ?? "book",
    rank: raw.rank ?? raw.rank_value,
    coverUrl: proxifyImageUrl(coverUrl),
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

export async function getCollectionItems(
  collectionId: string,
  start = 0,
  count = 20
): Promise<CollectionItemsResponse> {
  const response = await fetch(
    `/api/douban/collection/${collectionId}/items?start=${start}&count=${count}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch collection items (${response.status})`);
  }
  const data: RexxarItemsResponse = await response.json();
  return {
    total: data.total,
    start: data.start,
    count: data.count,
    meta: mapMeta(data.subject_collection),
    items: (data.subject_collection_items ?? []).map(mapItem)
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/collection-api.ts
git commit -m "feat: add collection API functions"
```

---

### Task 4: Create Collection Query Options

**Files:**
- Create: `src/lib/collection-queries.ts`

- [ ] **Step 1: Create the query options file**

```typescript
import { queryOptions } from "@tanstack/react-query";
import { getCollectionItems } from "@/lib/collection-api";

export function collectionItemsQueryOptions(
  collectionId: string,
  start = 0,
  count = 20
) {
  return queryOptions({
    queryKey: ["collection", "items", collectionId, start, count],
    queryFn: () => getCollectionItems(collectionId, start, count),
    enabled: Boolean(collectionId),
    staleTime: 5 * 60_000
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/collection-queries.ts
git commit -m "feat: add collection query options"
```

---

### Task 5: Create Collection Page

**Files:**
- Create: `src/routes/collection-page.tsx`

- [ ] **Step 1: Create the collection page component**

The page fetches the first page of items (which includes collection metadata in the response). Displays:
- Collection title + subtitle as header
- Followers count
- A grid of items, each showing rank, cover image, title, subtitle, and rating
- Each item links to `/book/:id` or `/movie/:id` based on its type
- "加载更多" button for pagination (loads next page and appends)

```tsx
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { collectionItemsQueryOptions } from "@/lib/collection-queries";
import { Badge } from "@/components/ui/badge";
import type { CollectionItem } from "@/types/collection";

export function CollectionPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const [loadedPages, setLoadedPages] = useState(1);
  const pageSize = 20;

  const { data, isLoading, error } = useQuery(
    collectionItemsQueryOptions(collectionId ?? "", 0, pageSize * loadedPages)
  );

  if (!collectionId) return null;

  if (isLoading) {
    return (
      <div className="animate-fade-up mx-auto w-full max-w-[1240px] px-5 pt-12 sm:px-8 lg:px-10">
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-2xl bg-[var(--muted)]" />
          <div className="h-6 w-40 animate-pulse rounded-xl bg-[var(--muted)]" />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-[var(--muted)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="animate-fade-up mx-auto w-full max-w-[1240px] px-5 pt-12 sm:px-8 lg:px-10">
        <p className="text-[var(--muted-foreground)]">
          无法加载榜单内容，请稍后重试。
        </p>
      </div>
    );
  }

  const { meta, items, total } = data;
  const hasMore = items.length < total;

  return (
    <div className="animate-fade-up mx-auto w-full max-w-[1240px] px-5 pt-4 sm:px-8 lg:px-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">
          {meta.title}
        </h1>
        {meta.subtitle ? (
          <p className="mt-2 text-lg text-[var(--muted-foreground)]">
            {meta.subtitle}
          </p>
        ) : null}
        <div className="mt-3 flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
          <span>{total} 部作品</span>
          {meta.followersCount ? (
            <span>{meta.followersCount.toLocaleString()} 人关注</span>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <CollectionItemCard key={item.id} item={item} />
        ))}
      </div>

      {hasMore ? (
        <div className="mt-8 flex justify-center pb-8">
          <button
            type="button"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--muted)]"
            onClick={() => setLoadedPages((p) => p + 1)}
          >
            加载更多
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CollectionItemCard({ item }: { item: CollectionItem }) {
  const linkPath =
    item.type === "book" ? `/book/${item.id}` : `/movie/${item.id}`;

  return (
    <Link
      to={linkPath}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/70 bg-[var(--surface)] shadow-[var(--shadow-warm-sm)] transition-shadow hover:shadow-[var(--shadow-warm-md)]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[var(--muted)]">
        {item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : null}
        {item.rank != null ? (
          <span className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white">
            {item.rank}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">
          {item.title}
        </h3>
        {item.cardSubtitle ? (
          <p className="line-clamp-1 text-xs text-[var(--muted-foreground)]">
            {item.cardSubtitle}
          </p>
        ) : null}
        {item.rating ? (
          <div className="mt-auto flex items-center gap-1 pt-1">
            <Star className="size-3 fill-current text-amber-500" />
            <span className="text-xs font-medium">{item.rating.value.toFixed(1)}</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/collection-page.tsx
git commit -m "feat: add collection page component"
```

---

### Task 6: Add Route and Wire Up Navigation

**Files:**
- Modify: `src/router.tsx`
- Modify: `src/routes/book-detail-page.tsx`

- [ ] **Step 1: Add collection route to router**

In `src/router.tsx`, add the import for collection queries at the top:
```typescript
import { collectionItemsQueryOptions } from "@/lib/collection-queries";
```

Then add the collection route inside the `DetailLayout` children array, after the celebrity route:
```typescript
{
  path: "/collection/:collectionId",
  loader({ params }) {
    if (params.collectionId) {
      void queryClient.ensureQueryData(
        collectionItemsQueryOptions(params.collectionId)
      );
    }
    return null;
  },
  lazy: () =>
    import("@/routes/collection-page").then((m) => ({
      Component: m.CollectionPage
    }))
},
```

- [ ] **Step 2: Make "上榜" badges clickable in book-detail-page**

In `src/routes/book-detail-page.tsx`, find the section that renders `subjectCollections` badges (around line 292-301). Change the static `<Badge>` to a `<Link>` wrapping a `<Badge>`:

Before:
```tsx
{bookDetail.subjectCollections.map((c) => (
  <Badge key={c.id}>{c.title}</Badge>
))}
```

After:
```tsx
{bookDetail.subjectCollections.map((c) => (
  <Link key={c.id} to={`/collection/${c.id}`}>
    <Badge className="cursor-pointer transition-colors hover:bg-[var(--accent)]">
      {c.title}
    </Badge>
  </Link>
))}
```

Make sure `Link` is imported from `react-router-dom` at the top of the file.

- [ ] **Step 3: Also make honor badges clickable if they have a collection link**

In the `DetailHeroSection` component (around line 238-246), the `honorInfos` badges currently show `#{rank} {title}`. These don't have a collection ID directly, so leave them as-is for now. (The Frodo API `honor_infos` don't include a `subject_collection_id` field — only `subjectCollections` has the `id`.)

- [ ] **Step 4: Verify the full flow**

Run the dev server and:
1. Search for a book that has subject collections (e.g. a popular book)
2. Open its detail page
3. Verify the "上榜" section shows clickable badges
4. Click a badge → verify it navigates to `/collection/:id`
5. Verify the collection page loads with title, items grid, and pagination

- [ ] **Step 5: Commit**

```bash
git add src/router.tsx src/routes/book-detail-page.tsx
git commit -m "feat: wire collection route and make badges clickable"
```

---

### Task 7: Handle Movie Collection Items

**Files:**
- Modify: `src/routes/collection-page.tsx` (minor — already handled)

The `CollectionItemCard` component already routes based on `item.type`:
- `"book"` → `/book/:id`
- `"movie"` / `"tv"` → `/movie/:id`

No additional work needed — this task is a verification step.

- [ ] **Step 1: Verify with a movie collection**

Test with a known movie collection (e.g. `movie_showing` or `movie_hot_gaia`):
```bash
curl -s "http://localhost:5173/api/douban/collection/movie_showing/items?start=0&count=5" | head -c 300
```

Navigate to `http://localhost:5173/collection/movie_showing` and verify movie items render correctly and link to `/movie/:id`.

- [ ] **Step 2: Commit (if any fixes needed)**

Only commit if changes were required.

---

## Research Findings (Reference)

### Rexxar API Details

The Douban mobile site uses a **Rexxar** hybrid framework. Two key endpoints:

| Endpoint | URL |
|----------|-----|
| Collection metadata | `GET https://m.douban.com/rexxar/api/v2/subject_collection/{id}` |
| Collection items | `GET https://m.douban.com/rexxar/api/v2/subject_collection/{id}/items?start=0&count=20` |

**Required headers:**
- `Referer: https://m.douban.com/` (returns 400 without it)
- `User-Agent`: mobile browser UA

**No API key needed** (unlike Frodo endpoints).

### Response structure (items endpoint)

```json
{
  "total": 10,
  "start": 0,
  "count": 5,
  "subject_collection": {
    "id": "ECZZABULI",
    "name": "豆瓣2025年度图书",
    "title": "豆瓣2025年度图书",
    "subtitle": "豆瓣榜单",
    "subject_type": "book",
    "total": 10,
    "followers_count": 22252
  },
  "subject_collection_items": [
    {
      "id": "37077202",
      "title": "九诗心",
      "type": "book",
      "rank": 1,
      "rating": { "value": 8.9, "count": 7040 },
      "pic": { "large": "https://img9.doubanio.com/..." },
      "card_subtitle": "黄晓丹 / 2024 / 上海三联书店"
    }
  ]
}
```

### Known Collection IDs

| ID | Name |
|----|------|
| `ECZZABULI` | 豆瓣2025年度图书 |
| `ECCQ7XHSA` | 豆瓣2025年度中国文学(小说) |
| `movie_showing` | 影院热映 |
| `movie_hot_gaia` | 豆瓣热门 |

The metadata response also includes `related_charts.items` — sibling collections with their IDs, which could be used for a "相关榜单" section in a future iteration.
