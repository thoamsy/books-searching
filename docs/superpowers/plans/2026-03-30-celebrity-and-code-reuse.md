# Celebrity Detail Page & Code Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add celebrity (director/actor) support to movie suggestions, create a celebrity detail page with filmography, make directors/cast clickable on movie detail pages, and reduce code duplication across the codebase.

**Architecture:** Extend the movie suggest API to handle `type: "celebrity"` entries. Add a Frodo celebrity proxy endpoint in the worker. Create a celebrity detail page (mirroring the author page pattern but for film people). Make movie detail directors/cast link to celebrity pages via name-based search. Extract shared utilities (history helpers, error boundaries) to reduce duplication.

**Tech Stack:** React, React Router, TanStack Query, Cloudflare Workers, Frodo Douban API

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/routes/celebrity-page.tsx` | Celebrity detail page with hero + filmography grid |
| Create | `src/lib/celebrity-queries.ts` | TanStack Query options for celebrity detail + works |
| Modify | `src/lib/movies-api.ts` | Add `getMovieCelebrityDetail()`, `getMovieCelebrityWorks()`, handle `celebrity` type in suggest |
| Modify | `src/types/movies.ts` | Add `CelebrityDetail`, `CelebrityWork`, update `MovieSuggestItem.type` |
| Modify | `src/routes/search-page.tsx` | Handle `celebrity` suggest items, add celebrity history |
| Modify | `src/routes/movie-detail-page.tsx` | Make directors/cast clickable links to `/celebrity/:name` |
| Modify | `src/router.tsx` | Add `/celebrity/:celebrityId` route |
| Modify | `worker/index.ts` | Add `/api/douban/celebrity/:id` and `/api/douban/celebrity/:id/works` proxy endpoints |
| Create | `src/lib/history-utils.ts` | Extract generic localStorage history read/write/push |
| Create | `src/components/query-error-boundary.tsx` | Extract shared error boundary component |

---

### Task 1: Add Celebrity Proxy Endpoints to Worker

**Files:**
- Modify: `worker/index.ts:108-127` (add before the movie detail route)

The Frodo API has two celebrity endpoints:
- `GET /api/v2/celebrity/{id}` — profile (name, photo, roles, birth info)
- `GET /api/v2/celebrity/{id}/works?start=0&count=50` — filmography with full movie/tv details

- [ ] **Step 1: Add celebrity detail proxy endpoint**

In `worker/index.ts`, add these routes before the movie detail regex match (before line 108):

```typescript
    const celebrityWorksMatch = url.pathname.match(/^\/api\/douban\/celebrity\/(\d+)\/works\/?$/);
    if (celebrityWorksMatch) {
      const celebrityId = celebrityWorksMatch[1];
      const frodoHeaders = {
        "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
        Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
      };
      const start = url.searchParams.get("start") ?? "0";
      const count = url.searchParams.get("count") ?? "50";
      return proxyRequest(
        `https://frodo.douban.com/api/v2/celebrity/${celebrityId}/works?apikey=0ac44ae016490db2204ce0a042db2916&start=${start}&count=${count}`,
        request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
      );
    }

    const celebrityMatch = url.pathname.match(/^\/api\/douban\/celebrity\/(\d+)\/?$/);
    if (celebrityMatch) {
      const celebrityId = celebrityMatch[1];
      const frodoHeaders = {
        "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
        Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
      };
      return proxyRequest(
        `https://frodo.douban.com/api/v2/celebrity/${celebrityId}?apikey=0ac44ae016490db2204ce0a042db2916`,
        request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
      );
    }
```

**Important:** The `celebrityWorksMatch` MUST come before `celebrityMatch` because `/celebrity/123/works` would otherwise be consumed by the celebrity detail regex if it didn't require `$` anchoring... actually both use `$` so order doesn't matter for correctness, but the works path is longer and more specific, so place it first for clarity.

- [ ] **Step 2: Verify locally**

Run: `pnpm build && npx wrangler dev --port 8788`

Then in another terminal:
```bash
curl -s "http://localhost:8788/api/douban/celebrity/1280317/" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title'))"
curl -s "http://localhost:8788/api/douban/celebrity/1280317/works" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total'), 'works')"
```

Expected: prints the celebrity name and works count.

- [ ] **Step 3: Commit**

```bash
git add worker/index.ts
git commit -m "feat(worker): add celebrity detail and works proxy endpoints"
```

---

### Task 2: Add Celebrity Types

**Files:**
- Modify: `src/types/movies.ts`

- [ ] **Step 1: Add CelebrityDetail and CelebrityWork types, update MovieSuggestItem**

Add to `src/types/movies.ts`:

```typescript
export interface CelebrityDetail {
  id: string;
  name: string;
  latinName?: string;
  coverUrl?: string;
  roles?: string;
  gender?: string;
  birthDate?: string;
  birthPlace?: string;
  imdbId?: string;
  doubanUrl?: string;
}

export interface CelebrityWork {
  id: string;
  title: string;
  coverUrl?: string;
  year?: string;
  type: "movie" | "tv";
  ratingsAverage?: number;
  roles: string[];
  genres?: string[];
}
```

Update `MovieSuggestItem.type` to include `"celebrity"`:

```typescript
export interface MovieSuggestItem {
  type: "movie" | "tv" | "celebrity";
  id: string;
  title: string;
  url: string;
  coverUrl?: string;
  subTitle?: string;
  year?: string;
  episode?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/movies.ts
git commit -m "feat(types): add CelebrityDetail, CelebrityWork types and celebrity suggest type"
```

---

### Task 3: Add Celebrity API Functions

**Files:**
- Modify: `src/lib/movies-api.ts`
- Create: `src/lib/celebrity-queries.ts`

- [ ] **Step 1: Update getMovieSuggestions to handle celebrity type**

In `src/lib/movies-api.ts`, update the `getMovieSuggestions` function. Change the type mapping from:

```typescript
type: entry.episode ? "tv" : "movie",
```

to:

```typescript
type: entry.type === "celebrity" ? "celebrity" : entry.episode ? "tv" : "movie",
```

- [ ] **Step 2: Add getCelebrityDetail and getCelebrityWorks functions**

Add to `src/lib/movies-api.ts`:

```typescript
interface FrodoCelebrityResponse {
  id: string;
  title: string;
  latin_title?: string;
  cover_img?: { url?: string };
  cover?: { large?: { url?: string }; normal?: { url?: string } };
  extra?: {
    short_info?: string;
    info?: [string, string][];
  };
  url?: string;
}

interface FrodoCelebrityWorksResponse {
  total: number;
  works: {
    work: {
      id: string;
      title: string;
      year?: string;
      type?: string;
      subtype?: string;
      pic?: { large?: string; normal?: string };
      cover_url?: string;
      rating?: { value?: number };
      genres?: string[];
    };
    roles: string[];
  }[];
}

export async function getCelebrityDetail(celebrityId: string): Promise<CelebrityDetail> {
  const response = await fetchProxy(`/api/douban/celebrity/${celebrityId}/`, "application/json");
  if (!response.ok) {
    throw new Error("Failed to fetch celebrity details.");
  }

  const data: FrodoCelebrityResponse = await response.json();
  const info = data.extra?.info ?? [];
  const findInfo = (key: string) => info.find(([k]) => k === key)?.[1];

  return {
    id: celebrityId,
    name: data.title || "未知影人",
    latinName: data.latin_title,
    coverUrl: proxifyImageUrl(data.cover?.large?.url ?? data.cover_img?.url),
    roles: data.extra?.short_info,
    gender: findInfo("性别"),
    birthDate: findInfo("出生日期"),
    birthPlace: findInfo("出生地"),
    imdbId: findInfo("IMDb编号"),
    doubanUrl: data.url
  };
}

export async function getCelebrityWorks(celebrityId: string): Promise<CelebrityWork[]> {
  const response = await fetchProxy(`/api/douban/celebrity/${celebrityId}/works`, "application/json");
  if (!response.ok) {
    throw new Error("Failed to fetch celebrity works.");
  }

  const data: FrodoCelebrityWorksResponse = await response.json();

  return data.works.map((entry) => ({
    id: entry.work.id,
    title: entry.work.title,
    coverUrl: proxifyImageUrl(entry.work.pic?.large ?? entry.work.cover_url),
    year: entry.work.year,
    type: entry.work.subtype === "tv" ? "tv" : "movie",
    ratingsAverage: entry.work.rating?.value,
    roles: entry.roles,
    genres: entry.work.genres
  }));
}
```

Note: `proxifyImageUrl` and `fetchProxy` are already defined in this file and can be reused directly.

Also add the import for the new types at the top of the file:

```typescript
import type { CelebrityDetail, CelebrityWork, MovieDetail, MovieSearchResponse, MovieSuggestItem, SearchMovie } from "@/types/movies";
```

- [ ] **Step 3: Create celebrity-queries.ts**

Create `src/lib/celebrity-queries.ts`:

```typescript
import { queryOptions } from "@tanstack/react-query";
import { getCelebrityDetail, getCelebrityWorks } from "@/lib/movies-api";

export function celebrityDetailQueryOptions(celebrityId: string) {
  return queryOptions({
    queryKey: ["celebrity", "detail", celebrityId],
    queryFn: () => getCelebrityDetail(celebrityId),
    enabled: Boolean(celebrityId)
  });
}

export function celebrityWorksQueryOptions(celebrityId: string) {
  return queryOptions({
    queryKey: ["celebrity", "works", celebrityId],
    queryFn: () => getCelebrityWorks(celebrityId),
    enabled: Boolean(celebrityId)
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/movies-api.ts src/lib/celebrity-queries.ts
git commit -m "feat(api): add celebrity detail and works API with query options"
```

---

### Task 4: Extract Shared Error Boundary Component

**Files:**
- Create: `src/components/query-error-boundary.tsx`
- Modify: `src/routes/book-detail-page.tsx` (remove local error boundary)
- Modify: `src/routes/movie-detail-page.tsx` (remove local error boundary)
- Modify: `src/routes/author-page.tsx` (remove local error boundary)

Currently, `QueryErrorBoundary` is copy-pasted identically in all three detail pages (book, movie, author). Extract it once.

- [ ] **Step 1: Create shared error boundary**

Create `src/components/query-error-boundary.tsx`:

```tsx
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface QueryErrorBoundaryProps {
  fallback: (props: { error: Error; reset: () => void }) => ReactNode;
  children: ReactNode;
}

interface QueryErrorBoundaryState {
  error: Error | null;
}

export class QueryErrorBoundary extends Component<QueryErrorBoundaryProps, QueryErrorBoundaryState> {
  state: QueryErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("QueryErrorBoundary:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Replace in book-detail-page.tsx**

Remove the entire `QueryErrorBoundary` class (the error boundary class definition, props interface, and state interface — approximately lines 31-60) from `src/routes/book-detail-page.tsx`. Add import:

```typescript
import { QueryErrorBoundary } from "@/components/query-error-boundary";
```

Remove these unused imports from the file: `Component`, `ErrorInfo` (keep `ReactNode` — it's used by the error fallback function signature).

- [ ] **Step 3: Replace in movie-detail-page.tsx**

Same removal of the local `QueryErrorBoundary` class in `src/routes/movie-detail-page.tsx`. Add import:

```typescript
import { QueryErrorBoundary } from "@/components/query-error-boundary";
```

Remove `Component`, `ErrorInfo` from imports (keep `ReactNode`).

- [ ] **Step 4: Replace in author-page.tsx**

Same removal in `src/routes/author-page.tsx`. Add import:

```typescript
import { QueryErrorBoundary } from "@/components/query-error-boundary";
```

Remove `Component`, `ErrorInfo` from imports (keep `ReactNode`).

- [ ] **Step 5: Verify**

Run: `pnpm build`
Expected: No type errors, no build errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/query-error-boundary.tsx src/routes/book-detail-page.tsx src/routes/movie-detail-page.tsx src/routes/author-page.tsx
git commit -m "refactor: extract shared QueryErrorBoundary component"
```

---

### Task 5: Extract History Utilities

**Files:**
- Create: `src/lib/history-utils.ts`
- Modify: `src/routes/search-page.tsx`

The search page has 3 sets of nearly identical read/write/push history functions. Extract the pattern.

- [ ] **Step 1: Create generic history utility**

Create `src/lib/history-utils.ts`:

```typescript
export function createHistoryStore<T>(options: {
  key: string;
  limit: number;
  validate: (item: unknown) => item is T;
  dedupKey: (item: T) => string;
}) {
  function read(): T[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(options.key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(options.validate);
    } catch {
      return [];
    }
  }

  function write(items: T[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(options.key, JSON.stringify(items));
  }

  function push(items: T[], entry: T): T[] {
    return [entry, ...items.filter((item) => options.dedupKey(item) !== options.dedupKey(entry))].slice(0, options.limit);
  }

  return { read, write, push };
}
```

- [ ] **Step 2: Refactor search-page.tsx to use createHistoryStore**

In `src/routes/search-page.tsx`, replace the six history functions (readSearchHistory, writeSearchHistory, pushSearchHistory, readAuthorHistory, writeAuthorHistory, pushAuthorHistory, readMovieHistory, writeMovieHistory, pushMovieHistory) with:

```typescript
import { createHistoryStore } from "@/lib/history-utils";

const bookHistory = createHistoryStore<RecentSearchEntry>({
  key: "book-echo-search-history",
  limit: 10,
  validate: (item): item is RecentSearchEntry =>
    item != null && typeof item === "object" &&
    typeof (item as RecentSearchEntry).workId === "string" &&
    typeof (item as RecentSearchEntry).query === "string" &&
    Boolean((item as RecentSearchEntry).book?.title),
  dedupKey: (item) => item.workId
});

const authorHistoryStore = createHistoryStore<RecentAuthorEntry>({
  key: "book-echo-author-history",
  limit: 8,
  validate: (item): item is RecentAuthorEntry =>
    item != null && typeof item === "object" &&
    typeof (item as RecentAuthorEntry).name === "string",
  dedupKey: (item) => item.name
});

const movieHistoryStore = createHistoryStore<RecentMovieEntry>({
  key: "book-echo-movie-history",
  limit: 10,
  validate: (item): item is RecentMovieEntry =>
    item != null && typeof item === "object" &&
    typeof (item as RecentMovieEntry).subjectId === "string" &&
    Boolean((item as RecentMovieEntry).movie),
  dedupKey: (item) => item.subjectId
});
```

Then replace all usage sites. For example, `readSearchHistory()` → `bookHistory.read()`, `writeSearchHistory(next)` → `bookHistory.write(next)`, `pushSearchHistory(current, entry)` → `bookHistory.push(current, entry)`.

Remove the old constants (`SEARCH_HISTORY_KEY`, `SEARCH_HISTORY_LIMIT`, `AUTHOR_HISTORY_KEY`, `AUTHOR_HISTORY_LIMIT`, `MOVIE_HISTORY_KEY`, `MOVIE_HISTORY_LIMIT`) and all the old function definitions.

Note: the old `pushSearchHistory` trims the query — move that trim into the calling code (`saveRecentBook`) instead:

```typescript
function saveRecentBook(book: SearchBook, workId: string, searchQuery: string) {
  const trimmedQuery = searchQuery.trim();
  if (!trimmedQuery) return;
  setSearchHistory((current) => {
    const next = bookHistory.push(current, { workId, query: trimmedQuery, book });
    bookHistory.write(next);
    return next;
  });
}
```

Similarly for `saveRecentMovie` and author history saves.

- [ ] **Step 3: Verify**

Run: `pnpm build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/history-utils.ts src/routes/search-page.tsx
git commit -m "refactor: extract generic history store utility from search page"
```

---

### Task 6: Handle Celebrity Type in Search Suggestions

**Files:**
- Modify: `src/routes/search-page.tsx`

- [ ] **Step 1: Update SearchOption kind to include "celebrity"**

Change the `kind` type in `SearchOption`:

```typescript
type SearchOption = {
  id: string;
  label: string;
  meta?: string;
  year?: string;
  kind: "book" | "author" | "movie" | "tv" | "celebrity";
  book?: SearchBook;
  movie?: SearchMovie;
  suggest?: SuggestItem;
  movieSuggest?: MovieSuggestItem;
};
```

- [ ] **Step 2: Update movieSuggestionOptions mapping**

Change the `movieSuggestionOptions` mapping to handle celebrity type:

```typescript
const movieSuggestionOptions: SearchOption[] = movieSuggestItems.map(
  (item, index) => ({
    id: getMovieSuggestionOptionId(item, index),
    label: item.title,
    meta: item.type === "celebrity"
      ? (item.subTitle || "影人")
      : (item.subTitle || (item.type === "tv" ? "电视剧" : "电影")),
    year: item.year ?? "",
    kind: item.type === "celebrity" ? "celebrity" as const : item.episode ? "tv" as const : "movie" as const,
    movie: item.type !== "celebrity" ? suggestItemToSearchMovie(item) : undefined,
    movieSuggest: item
  })
);
```

- [ ] **Step 3: Update handleOptionSelect to navigate celebrity**

Add celebrity handling in `handleOptionSelect`, before the movie check:

```typescript
if (option.kind === "celebrity" && option.movieSuggest) {
  setIsOpen(false);
  setIsComposing(false);
  navigate(`/celebrity/${option.movieSuggest.id}`);
  return;
}
```

- [ ] **Step 4: Update ComboboxItem rendering for celebrity**

In the `ComboboxList` render function, update the thumbnail and badge sections. The celebrity thumbnail should use a circular photo (like authors):

In the thumbnail section, add a celebrity case after the author case:

```tsx
{item.kind === "author" ? (
  // ... existing author thumbnail
) : item.kind === "celebrity" ? (
  <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/60 bg-white/50">
    {item.movieSuggest?.coverUrl ? (
      <img src={item.movieSuggest.coverUrl} alt={item.label} className="h-full w-full rounded-lg object-cover" loading="lazy" />
    ) : (
      <User className="size-5 text-[var(--muted-foreground)]" />
    )}
  </div>
) : (item.kind === "movie" || item.kind === "tv") ? (
  // ... existing movie/tv thumbnail
) : (
  // ... existing book thumbnail
)}
```

For the badge section, add celebrity after the author badge:

```tsx
{item.kind === "author" ? (
  <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">作者</span>
) : item.kind === "celebrity" ? (
  <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">影人</span>
) : (item.kind === "movie" || item.kind === "tv") ? (
  // ... existing movie/tv badge
) : item.year ? (
  // ... existing book badge
) : null}
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/search-page.tsx
git commit -m "feat(search): handle celebrity type in movie suggestions"
```

---

### Task 7: Create Celebrity Detail Page

**Files:**
- Create: `src/routes/celebrity-page.tsx`
- Modify: `src/router.tsx`

This page follows the same pattern as `author-page.tsx` but fetches data from the Frodo celebrity API instead of search. It shows the celebrity's profile info and a grid of their works (movies/TV shows).

- [ ] **Step 1: Create the celebrity page**

Create `src/routes/celebrity-page.tsx`:

```tsx
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, CalendarDays, ExternalLink, Film, ListOrdered, Star, Tv } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { BookCover } from "@/components/book-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { celebrityDetailQueryOptions, celebrityWorksQueryOptions } from "@/lib/celebrity-queries";
import type { CelebrityWork } from "@/types/movies";

type SortMode = "default" | "year" | "rating";
const SORT_LABELS: Record<SortMode, string> = { default: "默认", year: "年份", rating: "评分" };
const SORT_ORDER: SortMode[] = ["default", "year", "rating"];

function sortWorks(works: CelebrityWork[], mode: SortMode): CelebrityWork[] {
  if (mode === "default") return works;
  return [...works].sort((a, b) => {
    if (mode === "year") return Number(b.year ?? 0) - Number(a.year ?? 0);
    return (b.ratingsAverage ?? 0) - (a.ratingsAverage ?? 0);
  });
}

/* ------------------------------------------------------------------ */
/*  Works grid                                                         */
/* ------------------------------------------------------------------ */

function CelebrityWorksContent({ celebrityId }: { celebrityId: string }) {
  const { data: works } = useSuspenseQuery(celebrityWorksQueryOptions(celebrityId));
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const sorted = useMemo(() => sortWorks(works, sortMode), [works, sortMode]);

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
          参与作品
          {sorted.length > 0 ? (
            <span className="ml-2 text-[var(--muted-foreground)]/60">{sorted.length}</span>
          ) : null}
        </h2>
        {sorted.length > 1 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/50 px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition hover:bg-white/70 hover:text-[var(--foreground)]"
            onClick={() => {
              const nextIndex = (SORT_ORDER.indexOf(sortMode) + 1) % SORT_ORDER.length;
              setSortMode(SORT_ORDER[nextIndex]);
            }}
          >
            {sortMode === "default" ? <ListOrdered className="size-3" /> : sortMode === "year" ? <CalendarDays className="size-3" /> : <Star className="size-3" />}
            {SORT_LABELS[sortMode]}
          </button>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <div className="mt-8 rounded-[28px] border border-white/70 bg-[var(--surface)] px-8 py-12 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">未找到相关作品</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5 xl:gap-6">
          {sorted.map((work) => (
            <Link
              key={work.id}
              to={`/movie/${work.id}`}
              className="group text-left"
            >
              <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-white/60 bg-white/40 shadow-[var(--shadow-warm-sm)] transition group-hover:shadow-[var(--shadow-warm-md)]">
                <BookCover
                  src={work.coverUrl ?? null}
                  title={work.title}
                  className="rounded-2xl transition group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>
              <div className="mt-3 px-0.5">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">{work.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  {work.year ? (
                    <span className="text-xs text-[var(--muted-foreground)]">{work.year}</span>
                  ) : null}
                  {work.ratingsAverage ? (
                    <Badge variant="accent" className="gap-1 px-1.5 py-0 text-[10px]">
                      ★ {work.ratingsAverage.toFixed(1)}
                    </Badge>
                  ) : null}
                  {work.roles.length > 0 ? (
                    <span className="text-xs text-[var(--muted-foreground)]">{work.roles.join(" / ")}</span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function WorksGridSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">参与作品</h2>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5 xl:gap-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[2/3] rounded-2xl bg-white/50" />
            <div className="mt-3 px-0.5">
              <div className="h-4 w-3/4 rounded-full bg-white/50" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-white/50" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Error fallback                                                     */
/* ------------------------------------------------------------------ */

function WorksErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const message = error.message.includes("rate-limited")
    ? "豆瓣当前触发了风控或频率限制，请稍后重试。"
    : "获取影人作品失败，请稍后重试。";

  return (
    <div className="mt-8 rounded-[28px] border border-white/70 bg-[var(--surface)] px-8 py-12 text-center">
      <p className="text-sm text-[var(--destructive)]">{message}</p>
      <Button variant="outline" className="mt-4" onClick={reset}>
        重试
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero section                                                       */
/* ------------------------------------------------------------------ */

function CelebrityHero({ celebrityId }: { celebrityId: string }) {
  const { data: celebrity } = useSuspenseQuery(celebrityDetailQueryOptions(celebrityId));

  return (
    <div className="flex items-start gap-6 sm:items-center sm:gap-8">
      <div className="size-20 shrink-0 overflow-hidden rounded-full border-2 border-white/80 shadow-[var(--shadow-warm-sm)] sm:size-28">
        {celebrity.coverUrl ? (
          <img src={celebrity.coverUrl} alt={celebrity.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-white/80 to-[var(--accent)]">
            <span className="font-display text-2xl text-[var(--muted-foreground)] sm:text-3xl">
              {celebrity.name.charAt(0) || "?"}
            </span>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">影人</p>
        <h1 className="mt-1 font-display text-3xl font-medium leading-tight sm:text-4xl lg:text-5xl">
          {celebrity.name}
        </h1>
        {celebrity.latinName ? (
          <p className="mt-1.5 text-sm tracking-wide text-[var(--muted-foreground)]">
            {celebrity.latinName}
          </p>
        ) : null}
        {celebrity.roles ? (
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{celebrity.roles}</p>
        ) : null}
        {celebrity.doubanUrl ? (
          <a
            href={celebrity.doubanUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] transition hover:underline"
          >
            豆瓣主页
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="flex items-start gap-6 sm:items-center sm:gap-8">
      <div className="size-20 shrink-0 animate-pulse rounded-full bg-white/50 sm:size-28" />
      <div className="min-w-0 space-y-3">
        <div className="h-4 w-16 animate-pulse rounded-full bg-white/50" />
        <div className="h-10 w-48 animate-pulse rounded-full bg-white/50" />
        <div className="h-4 w-32 animate-pulse rounded-full bg-white/50" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page shell                                                         */
/* ------------------------------------------------------------------ */

export function CelebrityPage() {
  const { celebrityId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  if (!celebrityId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-center">
        <div>
          <p className="text-lg text-[var(--foreground)]">未找到该影人。</p>
          <Link to="/">
            <Button variant="outline" className="mt-6">返回搜索</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] pb-20 text-[var(--foreground)]">
      <div className="animate-fade-up mx-auto w-full max-w-[1240px] px-5 pt-6 sm:px-8 lg:px-10">
        <button
          type="button"
          onClick={() => location.key !== "default" ? navigate(-1) : navigate("/")}
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-sm text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="size-4" />
          返回
        </button>
      </div>

      <section className="animate-fade-up mx-auto mt-8 w-full max-w-[1240px] px-5 [animation-delay:80ms] sm:px-8 lg:px-10">
        <QueryErrorBoundary fallback={({ error, reset }) => (
          <WorksErrorFallback error={error} reset={reset} />
        )}>
          <Suspense fallback={<HeroSkeleton />}>
            <CelebrityHero celebrityId={celebrityId} />
          </Suspense>
        </QueryErrorBoundary>
      </section>

      <section className="animate-fade-up mx-auto mt-12 w-full max-w-[1240px] px-5 [animation-delay:160ms] sm:px-8 lg:px-10">
        <QueryErrorBoundary fallback={({ error, reset }) => (
          <WorksErrorFallback error={error} reset={reset} />
        )}>
          <Suspense fallback={<WorksGridSkeleton />}>
            <CelebrityWorksContent celebrityId={celebrityId} />
          </Suspense>
        </QueryErrorBoundary>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Add route to router.tsx**

In `src/router.tsx`, add import and route:

```typescript
import { CelebrityPage } from "@/routes/celebrity-page";
```

Add route inside the children array, after the author route:

```typescript
{
  path: "/celebrity/:celebrityId",
  loader: ({ params }) => {
    if (params.celebrityId) {
      queryClient.ensureQueryData(celebrityDetailQueryOptions(params.celebrityId));
      queryClient.ensureQueryData(celebrityWorksQueryOptions(params.celebrityId));
    }
    return null;
  },
  element: <CelebrityPage />
}
```

Also add the query options imports:

```typescript
import { celebrityDetailQueryOptions, celebrityWorksQueryOptions } from "@/lib/celebrity-queries";
```

- [ ] **Step 3: Verify**

Run: `pnpm build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/celebrity-page.tsx src/router.tsx
git commit -m "feat: add celebrity detail page with filmography grid"
```

---

### Task 8: Make Movie Detail Directors/Cast Clickable

**Files:**
- Modify: `src/routes/movie-detail-page.tsx`

The Frodo movie API only returns `{name: string}` for directors/actors (no IDs). We'll link directors/cast to a search-based approach: navigate to the search page with the person's name pre-filled, which will trigger the suggest API and show the celebrity result.

Since directors are currently `<span>` elements and authors on the book page are `<Link>` elements with underline animation, we should make directors/cast match that pattern.

- [ ] **Step 1: Import Link**

`Link` is already imported from `react-router-dom` in `movie-detail-page.tsx`. No change needed.

- [ ] **Step 2: Update director rendering in DetailHeroPanel**

Replace the director `<span>` in the directors section (lines ~285-293) with a `<Link>`:

```tsx
{directors.map((director) => (
  <Link
    key={director}
    to={`/?q=${encodeURIComponent(director)}`}
    className="group/person inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/[0.06] px-3 py-1 text-sm font-medium text-[var(--primary)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-px hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/[0.1] hover:shadow-[0_4px_12px_color-mix(in_oklch,var(--primary)_12%,transparent)]"
  >
    <Clapperboard className="size-3.5" />
    <span className="bg-[linear-gradient(var(--primary),var(--primary))] bg-[length:0%_1.5px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 ease-out group-hover/person:bg-[length:100%_1.5px]">
      {director}
    </span>
  </Link>
))}
```

- [ ] **Step 3: Update cast rendering in DetailHeroPanel**

Replace the cast `<span>` (lines ~300-308) with a similar `<Link>`:

```tsx
{cast.slice(0, 5).map((actor) => (
  <Link
    key={actor}
    to={`/?q=${encodeURIComponent(actor)}`}
    className="group/person inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/40 px-3 py-1 text-sm text-[var(--foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-px hover:border-white/80 hover:bg-white/60 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
  >
    <Users className="size-3.5" />
    <span className="bg-[linear-gradient(var(--foreground),var(--foreground))] bg-[length:0%_1.5px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 ease-out group-hover/person:bg-[length:100%_1.5px]">
      {actor}
    </span>
  </Link>
))}
```

- [ ] **Step 4: Update MobileHeroPanel directors too**

In `MobileHeroPanel` (around line 495), the directors are rendered as plain text in a `<p>` tag. Make them clickable too:

Replace:
```tsx
<p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
  导演: {directors.slice(0, 2).join(" / ")}
</p>
```

With:
```tsx
<p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
  导演: {directors.slice(0, 2).map((director, i) => (
    <span key={director}>
      {i > 0 && " / "}
      <Link to={`/?q=${encodeURIComponent(director)}`} className="underline decoration-[var(--border)] underline-offset-4 transition hover:decoration-[var(--foreground)] hover:text-[var(--foreground)]">
        {director}
      </Link>
    </span>
  ))}
</p>
```

- [ ] **Step 5: Verify**

Run: `pnpm build`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/movie-detail-page.tsx
git commit -m "feat(movie-detail): make directors and cast clickable with search links"
```

---

### Task 9: Deploy and Verify

- [ ] **Step 1: Build and deploy**

```bash
pnpm build && npx wrangler deploy
```

- [ ] **Step 2: Verify celebrity proxy endpoints**

```bash
curl -s "https://book-echo-douban-proxy.thoamsy.workers.dev/api/douban/celebrity/1280317/" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title'))"
curl -s "https://book-echo-douban-proxy.thoamsy.workers.dev/api/douban/celebrity/1280317/works" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total'), 'works')"
```

Expected: prints celebrity name and works count.

- [ ] **Step 3: Manual smoke test**

Open the deployed site. Search for "彼得·卡坦纽" (or any person name). The celebrity suggestion should appear with an "影人" badge. Click it to open the celebrity page with profile and filmography.

On a movie detail page, click a director or cast member name — it should navigate to the search page with their name pre-filled.

- [ ] **Step 4: Commit if any fixes needed, then final deploy**
