import { Suspense } from "react";
import { useParams, Link } from "react-router-dom";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { DetailErrorFallback } from "@/components/detail-error-fallback";
import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { collectionItemsQueryOptions } from "@/lib/collection-queries";
import type { CollectionItem } from "@/types/collection";

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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <CollectionItemCard key={item.id} item={item} />
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

/* ------------------------------------------------------------------ */
/*  Item card                                                          */
/* ------------------------------------------------------------------ */

function CollectionItemCard({ item }: { item: CollectionItem }) {
  // Movie proxy handles TV fallback, so both movie and tv route to /movie/
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
