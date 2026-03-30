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
