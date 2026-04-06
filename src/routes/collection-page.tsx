import { Suspense, useEffect, useEffectEvent, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { DetailErrorFallback } from "@/components/detail-error-fallback";
import { MediaCard } from "@/components/media-card";
import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useColumnCount } from "@/hooks/use-column-count";
import { collectionItemsQueryOptions } from "@/lib/collection-queries";
import { useAuth } from "@/lib/auth-context";
import {
  bookmarksQueryOptions,
  useUpdateBookmarkCovers,
} from "@/lib/bookmark-queries";

function CollectionSkeleton() {
  return (
    <div className="@container animate-fade-up mx-auto w-full max-w-[1240px] px-5 pt-4 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-6 w-40 rounded-lg" />
        <div className="mt-8 grid grid-cols-2 gap-4 @xl:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

const ESTIMATED_ROW_HEIGHT = 340;
const GAP_Y = 24; // gap-y-6 = 1.5rem

function CollectionContent({ collectionId }: { collectionId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(collectionItemsQueryOptions(collectionId));

  const { meta, total } = data.pages[0];
  const items = useMemo(
    () => data.pages.flatMap((page) => page.items),
    [data.pages],
  );

  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: bookmarks = [] } = useQuery(bookmarksQueryOptions(userId));
  const { mutate: updateCovers } = useUpdateBookmarkCovers();

  const refreshCoversIfStale = useEffectEvent(() => {
    if (items.length === 0) return;

    const bookmark = bookmarks.find(
      (b) => b.item_id === collectionId && b.item_type === "collection"
    );
    if (!bookmark) return;

    const currentUrls = items
      .slice(0, 4)
      .map((item) => item.normalCoverUrl)
      .filter((url): url is string => Boolean(url));
    if (currentUrls.length === 0) return;

    const storedUrls = bookmark.item_cover_urls ?? [];
    const isDifferent =
      currentUrls.length !== storedUrls.length ||
      currentUrls.some((url, i) => url !== storedUrls[i]);

    if (isDifferent) {
      updateCovers({ itemId: collectionId, coverUrls: currentUrls });
    }
  });

  // Refresh stale cover URLs once when visiting a bookmarked collection.
  // collectionId change remounts via Suspense, so this runs once per visit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refreshCoversIfStale, []);

  const gridRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(gridRef);
  const rowCount = Math.ceil(items.length / columnCount);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 3,
    gap: GAP_Y,
    scrollMargin: gridRef.current?.offsetTop ?? 0,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualIndex = virtualItems.at(-1)?.index ?? -1;

  // Auto-fetch next page when last row is near viewport
  useEffect(() => {
    if (lastVirtualIndex >= rowCount - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [lastVirtualIndex, rowCount, hasNextPage, isFetchingNextPage, fetchNextPage]);

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
          <p className="mt-2 text-lg text-muted-foreground">
            {meta.subtitle}
          </p>
        ) : null}
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
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
        {virtualItems.map((virtualRow) => {
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
                className="grid gap-x-4"
                style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: columnCount }, (_, colIndex) => {
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
          <span className="text-sm text-muted-foreground">加载中…</span>
        </div>
      ) : null}
    </div>
  );
}

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
