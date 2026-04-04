# Virtual Grid for Collection Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Virtualize the collection page grid using TanStack Virtual so that large collections (e.g. 豆瓣电影Top250 with 250 items) render only visible rows, and auto-fetch the next page when scrolling near the bottom.

**Architecture:** Use `useWindowVirtualizer` (since the page scrolls on `window`, not a custom scroll container) to virtualize rows of a responsive grid. A `ResizeObserver` on the grid container determines column count at each breakpoint. Each virtual row renders N `MediaCard` components via CSS `grid`. Infinite scroll replaces the "加载更多" button — `fetchNextPage()` fires automatically when the last virtual row enters the viewport.

**Tech Stack:** `@tanstack/react-virtual` (new dependency), existing `@tanstack/react-query` infinite query, existing `MediaCard` component.

---

## Scope

Only the **collection page** (`src/routes/collection-page.tsx`) needs virtualization. Other grids (author page ~50 items, celebrity page ~100 items, search page 10 items) are too small to benefit — virtualizing them would add complexity for no gain.

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/hooks/use-column-count.ts` | Hook: observes container width → returns responsive column count |
| Modify | `src/routes/collection-page.tsx` | Replace flat grid with virtualized rows + auto-fetch on scroll |

---

### Task 1: Install @tanstack/react-virtual

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

```bash
npm install @tanstack/react-virtual
```

- [ ] **Step 2: Verify installation**

Run: `npx tsc --noEmit`
Expected: Clean, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @tanstack/react-virtual"
```

---

### Task 2: Create useColumnCount hook

**Files:**
- Create: `src/hooks/use-column-count.ts`

This hook uses `ResizeObserver` to watch a container element's width and returns the current column count based on Tailwind breakpoints. It must match the existing responsive grid breakpoints used in collection-page.tsx:

| Container width | Columns | Tailwind class |
|----------------|---------|----------------|
| < 640px | 2 | `grid-cols-2` (default) |
| 640–767px | 3 | `sm:grid-cols-3` |
| 768–1023px | 4 | `md:grid-cols-4` |
| ≥ 1024px | 5 | `lg:grid-cols-5` |

- [ ] **Step 1: Create the hook**

```typescript
import { useEffect, useState, type RefObject } from "react";

const BREAKPOINTS: [number, number][] = [
  [1024, 5],
  [768, 4],
  [640, 3],
];
const DEFAULT_COLUMNS = 2;

export function useColumnCount(ref: RefObject<HTMLElement | null>): number {
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const cols =
        BREAKPOINTS.find(([bp]) => width >= bp)?.[1] ?? DEFAULT_COLUMNS;
      setColumns(cols);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return columns;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-column-count.ts
git commit -m "feat: add useColumnCount hook with ResizeObserver"
```

---

### Task 3: Virtualize the collection grid

**Files:**
- Modify: `src/routes/collection-page.tsx`

Replace the flat `<div className="grid ...">` with `useWindowVirtualizer` that:
1. Virtualizes **rows** (not individual items) — `count = Math.ceil(items.length / columnCount)`
2. Each virtual row renders `columnCount` MediaCards in a CSS grid
3. Auto-fetches next page when the last row enters the viewport (replacing the "加载更多" button)
4. Uses `useWindowVirtualizer` since the page scrolls on `window`
5. Uses `scrollMargin` to account for the header offset above the grid

- [ ] **Step 1: Rewrite CollectionContent**

Replace the entire `CollectionContent` function in `src/routes/collection-page.tsx`:

```tsx
import { Suspense, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { DetailErrorFallback } from "@/components/detail-error-fallback";
import { MediaCard } from "@/components/media-card";
import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { useColumnCount } from "@/hooks/use-column-count";
import { collectionItemsQueryOptions } from "@/lib/collection-queries";

/* ------------------------------------------------------------------ */
/*  Skeleton fallback                                                  */
/* ------------------------------------------------------------------ */

function CollectionSkeleton() {
  return (
    <div className="animate-fade-up mx-auto w-full max-w-[1240px] px-5 pt-4 sm:px-8 lg:px-10">
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

/* ------------------------------------------------------------------ */
/*  Estimated row height                                               */
/*  cover aspect-[2/3] + gap + text ≈ depends on card width           */
/*  A rough estimate; the virtualizer will measure actual sizes.       */
/* ------------------------------------------------------------------ */

const ESTIMATED_ROW_HEIGHT = 340;
const GAP_Y = 24; // gap-y-6 = 1.5rem = 24px

/* ------------------------------------------------------------------ */
/*  Content (suspends on initial load only)                            */
/* ------------------------------------------------------------------ */

function CollectionContent({ collectionId }: { collectionId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(collectionItemsQueryOptions(collectionId));

  const meta = data.pages[0].meta;
  const total = data.pages[0].total;
  const items = data.pages.flatMap((page) => page.items);

  const gridRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(gridRef);
  const rowCount = Math.ceil(items.length / columnCount);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ESTIMATED_ROW_HEIGHT + GAP_Y,
    overscan: 3,
    scrollMargin: gridRef.current?.offsetTop ?? 0,
  });

  // Auto-fetch next page when last row is near viewport
  useEffect(() => {
    const lastRow = virtualizer.getVirtualItems().at(-1);
    if (!lastRow) return;
    if (lastRow.index >= rowCount - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualizer.getVirtualItems(), rowCount, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Re-measure when column count changes (breakpoint)
  useEffect(() => {
    virtualizer.measure();
  }, [columnCount, virtualizer]);

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

      <div
        ref={gridRef}
        style={{ height: virtualizer.getTotalSize(), position: "relative" }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              <div
                className="grid gap-x-4 gap-y-6"
                style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: columnCount }).map((_, colIndex) => {
                  const itemIndex = startIndex + colIndex;
                  if (itemIndex >= items.length) return null;
                  const item = items[itemIndex];
                  return (
                    <MediaCard
                      key={item.id}
                      to={item.type === "book" ? `/book/${item.id}` : `/movie/${item.id}`}
                      coverUrl={item.coverUrl ?? null}
                      title={item.title}
                      subtitle={item.cardSubtitle}
                      rating={item.rating?.value}
                      rank={item.rank}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {isFetchingNextPage ? (
        <div className="flex justify-center py-8">
          <span className="text-sm text-[var(--muted-foreground)]">加载中…</span>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page shell                                                         */
/* ------------------------------------------------------------------ */

export function CollectionPage() {
  const { collectionId } = useParams<{ collectionId: string }>();

  if (!collectionId) return null;

  return (
    <QueryErrorBoundary
      fallback={({ error, reset }) => (
        <DetailErrorFallback error={error} reset={reset} entityLabel="榜单" />
      )}
    >
      <Suspense fallback={<CollectionSkeleton />}>
        <CollectionContent collectionId={collectionId} />
      </Suspense>
    </QueryErrorBoundary>
  );
}
```

Key decisions:
- **`useWindowVirtualizer`** — the page has no custom scroll container; `window` is the scroller.
- **`scrollMargin`** — offsets for the header/title above the grid so row positions are calculated correctly.
- **`ref={virtualizer.measureElement}` + `data-index`** — enables dynamic row height measurement (row height varies with card width at different breakpoints).
- **`gridTemplateColumns` via inline style** — the column count is dynamic (from `useColumnCount`), so we can't use static Tailwind classes. Gap classes (`gap-x-4 gap-y-6`) remain as Tailwind since they're constant.
- **Auto-fetch** replaces the "加载更多" button — fires `fetchNextPage()` when the last row enters the overscan zone.
- **Loading indicator** — shows "加载中…" at the bottom while fetching.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: Clean.

- [ ] **Step 3: Manual test**

Start dev server and navigate to `/collection/movie_top250`:
1. Scroll down — items should appear smoothly, no jank
2. Check DOM — only a subset of rows should be rendered (not all 250 items)
3. Scroll near bottom — next page should auto-fetch
4. Resize window — column count should adapt, grid re-layouts
5. Navigate to a card and back — scroll position should restore (ScrollRestoration)

- [ ] **Step 4: Commit**

```bash
git add src/routes/collection-page.tsx
git commit -m "feat: virtualize collection grid with auto-fetch on scroll"
```

---

### Task 4: Tune and polish

**Files:**
- Modify: `src/routes/collection-page.tsx` (if needed)

- [ ] **Step 1: Test with small collections**

Navigate to `/collection/ECZZABULI` (10 items). Verify:
- All 10 items render (no blank space)
- No auto-fetch loop (should stop when `hasNextPage` is false)
- Grid looks identical to before virtualization

- [ ] **Step 2: Test with movie collections**

Navigate to `/collection/movie_top250`. Verify:
- Smooth scroll through 250 items
- DOM has ~15-25 rows rendered at any time (not 50+)
- Images lazy-load correctly
- Back navigation preserves scroll position

- [ ] **Step 3: Test responsive breakpoints**

Resize browser at `/collection/movie_top250`:
- 320px width → 2 columns
- 640px → 3 columns
- 768px → 4 columns
- 1024px+ → 5 columns
- Columns transition smoothly, no layout jump

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add src/routes/collection-page.tsx src/hooks/use-column-count.ts
git commit -m "fix: tune virtual grid sizing and edge cases"
```

---

## Design Decisions

**Why only collection page?**
- Author page: ~50 items max, single query, no pagination → virtualization overhead not justified
- Celebrity page: ~100 items max, single query → same reasoning
- Search page: 10 items max → trivially small

**Why `useWindowVirtualizer` instead of `useVirtualizer`?**
The collection page sits inside `DetailLayout` which renders in the normal document flow. There's no custom scroll container — the page scrolls via `window`. `useWindowVirtualizer` is designed for exactly this case.

**Why row virtualization instead of cell virtualization?**
TanStack Virtual's dual-axis virtualizer is designed for spreadsheet-like 2D scrolling. For a responsive card grid that only scrolls vertically, virtualizing rows (where each row renders N cards) is simpler and works naturally with CSS grid for intra-row layout.

**Why auto-fetch instead of "加载更多" button?**
With virtualization, the user never sees the end of the list until they scroll there. A button at the bottom would require scrolling past empty space. Auto-fetching when the last row enters the overscan zone provides a seamless experience — new items appear before the user reaches the bottom.
