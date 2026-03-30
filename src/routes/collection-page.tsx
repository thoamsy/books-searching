import { Suspense } from "react";
import { useParams } from "react-router-dom";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { DetailErrorFallback } from "@/components/detail-error-fallback";
import { MediaCard } from "@/components/media-card";
import { QueryErrorBoundary } from "@/components/query-error-boundary";
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
/*  Content (suspends on initial load only)                            */
/* ------------------------------------------------------------------ */

function CollectionContent({ collectionId }: { collectionId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(collectionItemsQueryOptions(collectionId));

  const meta = data.pages[0].meta;
  const total = data.pages[0].total;
  const items = data.pages.flatMap((page) => page.items);

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

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            to={item.type === "book" ? `/book/${item.id}` : `/movie/${item.id}`}
            coverUrl={item.coverUrl ?? null}
            title={item.title}
            subtitle={item.cardSubtitle}
            rating={item.rating?.value}
            rank={item.rank}
          />
        ))}
      </div>

      {hasNextPage ? (
        <div className="mt-8 flex justify-center pb-8">
          <button
            type="button"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "加载中…" : "加载更多"}
          </button>
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

