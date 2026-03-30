import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ExternalLink, ListOrdered, Star } from "lucide-react";
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

function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const message = error.message.includes("rate-limited")
    ? "豆瓣当前触发了风控或频率限制，请稍后重试。"
    : "获取影人信息失败，请稍后重试。";

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
          <ErrorFallback error={error} reset={reset} />
        )}>
          <Suspense fallback={<HeroSkeleton />}>
            <CelebrityHero celebrityId={celebrityId} />
          </Suspense>
        </QueryErrorBoundary>
      </section>

      <section className="animate-fade-up mx-auto mt-12 w-full max-w-[1240px] px-5 [animation-delay:160ms] sm:px-8 lg:px-10">
        <QueryErrorBoundary fallback={({ error, reset }) => (
          <ErrorFallback error={error} reset={reset} />
        )}>
          <Suspense fallback={<WorksGridSkeleton />}>
            <CelebrityWorksContent celebrityId={celebrityId} />
          </Suspense>
        </QueryErrorBoundary>
      </section>
    </main>
  );
}
