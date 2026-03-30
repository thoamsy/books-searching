import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { CalendarDays, ExternalLink, ListOrdered, Star } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { BookCover } from "@/components/book-cover";
import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCoverUrl, normalizeWorkId } from "@/lib/books-api";
import { searchBooksQueryOptions } from "@/lib/book-queries";
import type { SearchBook } from "@/types/books";

type SortMode = "default" | "year" | "rating";

const SORT_KEY = "opus-author-sort";
const SORT_LABELS: Record<SortMode, string> = {
  default: "默认",
  year: "出版时间",
  rating: "评分"
};
const SORT_ORDER: SortMode[] = ["default", "year", "rating"];

function readSortPreference(): SortMode {
  if (typeof window === "undefined") return "default";
  const value = window.localStorage.getItem(SORT_KEY);
  return SORT_ORDER.includes(value as SortMode) ? (value as SortMode) : "default";
}

function writeSortPreference(mode: SortMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SORT_KEY, mode);
}

function sortBooks(books: SearchBook[], mode: SortMode): SearchBook[] {
  if (mode === "default") return books;
  return [...books].sort((a, b) => {
    if (mode === "year") {
      return (b.firstPublishYear ?? 0) - (a.firstPublishYear ?? 0);
    }
    return (b.ratingsAverage ?? 0) - (a.ratingsAverage ?? 0);
  });
}

/* ------------------------------------------------------------------ */
/*  Skeleton fallback                                                  */
/* ------------------------------------------------------------------ */

function BooksGridSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
          相关作品
        </h2>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5 xl:gap-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[3/4] rounded-2xl bg-white/50" />
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

function BooksErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const message = error.message.includes("rate-limited")
    ? "豆瓣当前触发了风控或频率限制，请稍后重试。"
    : "获取作品列表失败，请稍后再试。";

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
/*  Books section (suspends while loading)                             */
/* ------------------------------------------------------------------ */

function AuthorBooksContent({ authorName }: { authorName: string }) {
  const { data } = useSuspenseQuery(searchBooksQueryOptions(authorName));
  const [sortMode, setSortMode] = useState<SortMode>(readSortPreference);
  const books = useMemo(() => sortBooks(data.docs, sortMode), [data.docs, sortMode]);

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
          相关作品
          {books.length > 0 ? (
            <span className="ml-2 text-[var(--muted-foreground)]/60">{books.length}</span>
          ) : null}
        </h2>
        {books.length > 1 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/50 px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition hover:bg-white/70 hover:text-[var(--foreground)]"
            onClick={() => {
              const nextIndex = (SORT_ORDER.indexOf(sortMode) + 1) % SORT_ORDER.length;
              const next = SORT_ORDER[nextIndex];
              setSortMode(next);
              writeSortPreference(next);
            }}
          >
            {sortMode === "default" ? <ListOrdered className="size-3" /> : sortMode === "year" ? <CalendarDays className="size-3" /> : <Star className="size-3" />}
            {SORT_LABELS[sortMode]}
          </button>
        ) : null}
      </div>

      {books.length === 0 ? (
        <div className="mt-8 rounded-[28px] border border-white/70 bg-[var(--surface)] px-8 py-12 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">未找到相关作品</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5 xl:gap-6">
          {books.map((book) => {
            const workId = normalizeWorkId(book.key);
            if (!workId) return null;

            return (
              <Link
                key={workId}
                to={`/book/${workId}?q=${encodeURIComponent(authorName)}`}
                state={{ book }}
                className="group text-left"
              >
                <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-white/60 bg-white/40 shadow-[var(--shadow-warm-sm)] transition group-hover:shadow-[var(--shadow-warm-md)]">
                  <BookCover
                    src={getCoverUrl(book.coverUrl)}
                    title={book.title}
                    className="rounded-2xl transition group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
                <div className="mt-3 px-0.5">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {book.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {book.firstPublishYear ? (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {book.firstPublishYear}
                      </span>
                    ) : null}
                    {book.ratingsAverage ? (
                      <Badge variant="accent" className="gap-1 px-1.5 py-0 text-[10px]">
                        ★ {book.ratingsAverage.toFixed(1)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page shell                                                         */
/* ------------------------------------------------------------------ */

export function AuthorPage() {
  const { authorName } = useParams();
  const [searchParams] = useSearchParams();
  const photoUrl = searchParams.get("photo") ?? undefined;
  const enName = searchParams.get("en") ?? undefined;
  const doubanUrl = searchParams.get("url") ?? undefined;
  const decodedName = decodeURIComponent(authorName ?? "");

  return (
    <>
      {/* Author hero */}
      <section className="animate-fade-up mx-auto mt-8 w-full max-w-[1240px] px-5 [animation-delay:80ms] sm:px-8 lg:px-10">
        <div className="flex items-start gap-6 sm:items-center sm:gap-8">
          <div className="size-20 shrink-0 overflow-hidden rounded-full border-2 border-white/80 shadow-[var(--shadow-warm-sm)] sm:size-28">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={decodedName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-white/80 to-[var(--accent)]">
                <span className="font-display text-2xl text-[var(--muted-foreground)] sm:text-3xl">
                  {decodedName.replace(/[\[\]（）()【】\s]/g, "").charAt(0) || "?"}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
              作者
            </p>
            <h1 className="mt-1 font-display text-3xl font-medium leading-tight sm:text-4xl lg:text-5xl">
              {decodedName}
            </h1>
            {enName ? (
              <p className="mt-1.5 text-sm tracking-wide text-[var(--muted-foreground)]">
                {enName}
              </p>
            ) : null}
            {doubanUrl ? (
              <a
                href={doubanUrl}
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
      </section>

      {/* Books section */}
      <section className="animate-fade-up mx-auto mt-12 w-full max-w-[1240px] px-5 [animation-delay:160ms] sm:px-8 lg:px-10">
        <QueryErrorBoundary
          fallback={({ error, reset }) => (
            <BooksErrorFallback error={error} reset={reset} />
          )}
        >
          <Suspense fallback={<BooksGridSkeleton />}>
            <AuthorBooksContent authorName={decodedName} />
          </Suspense>
        </QueryErrorBoundary>
      </section>
    </>
  );
}
