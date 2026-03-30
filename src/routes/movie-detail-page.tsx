import { useSuspenseQuery } from "@tanstack/react-query";
import { Component, Suspense } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clapperboard,
  Clock,
  ExternalLink,
  Film,
  RotateCw,
  Star,
  Tv,
  Users
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { BookCover } from "@/components/book-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { movieDetailQueryOptions } from "@/lib/movie-queries";
import type { MovieDetail, SearchMovie } from "@/types/movies";

interface LocationState {
  movie?: SearchMovie;
}

/* ------------------------------------------------------------------ */
/*  Error boundary                                                     */
/* ------------------------------------------------------------------ */

interface ErrorBoundaryProps {
  fallback: (props: { error: Error; reset: () => void }) => ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class QueryErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("MovieDetailPage error boundary:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }
    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/*  Error fallback                                                     */
/* ------------------------------------------------------------------ */

function DetailErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const message = error.message.includes("rate-limited")
    ? "豆瓣详情页当前触发了风控或频率限制，请稍后重试。"
    : "影片详情获取失败，请稍后重试。";

  return (
    <div className="mx-auto mt-10 w-full max-w-[1240px] px-5 text-center sm:px-8 lg:px-10">
      <div className="rounded-[32px] border border-white/70 bg-[var(--surface)] px-8 py-12">
        <p className="text-lg text-[var(--destructive)]">{message}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={reset}>
            <RotateCw className="size-4" />
            重试
          </Button>
          <Link to="/">
            <Button variant="ghost">返回搜索</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton fallback                                                  */
/* ------------------------------------------------------------------ */

function MovieDetailSkeleton({ fallbackMovie }: { fallbackMovie?: SearchMovie }) {
  return (
    <section className="mx-auto mt-8 w-full max-w-[1240px] px-5 sm:px-8 lg:px-10">
      {/* Mobile skeleton */}
      <div className="animate-fade-up flex gap-5 [animation-delay:80ms] lg:hidden">
        <div className="w-[120px] shrink-0">
          <div className="aspect-[2/3] overflow-hidden rounded-[20px]">
            {fallbackMovie?.coverUrl ? (
              <BookCover src={fallbackMovie.coverUrl} title={fallbackMovie?.title ?? "海报"} className="rounded-[20px] opacity-70 saturate-75" />
            ) : (
              <div className="h-full w-full animate-pulse rounded-[20px] bg-white/70" />
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <MobileHeroSkeleton fallbackMovie={fallbackMovie} />
        </div>
      </div>

      {/* Desktop skeleton */}
      <div className="animate-fade-up hidden [animation-delay:80ms] lg:grid lg:grid-cols-[320px_1fr] lg:items-start lg:gap-10">
        <CoverPanelSkeleton title={fallbackMovie?.title} coverUrl={fallbackMovie?.coverUrl} />
        <div className="space-y-10">
          <HeroPanelSkeleton fallbackMovie={fallbackMovie} />
          <div className="grid gap-8 lg:grid-cols-[1.45fr_0.95fr]">
            <DescriptionPanelSkeleton />
            <SidebarPanelSkeleton />
          </div>
        </div>
      </div>

      {/* Mobile content skeleton */}
      <div className="animate-fade-up mt-10 space-y-8 [animation-delay:160ms] lg:hidden">
        <div className="grid gap-8">
          <DescriptionPanelSkeleton />
          <SidebarPanelSkeleton />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Content (suspends while loading)                                   */
/* ------------------------------------------------------------------ */

function MovieDetailContent({ subjectId, fallbackMovie }: { subjectId: string; fallbackMovie?: SearchMovie }) {
  const { data: movieDetail } = useSuspenseQuery(movieDetailQueryOptions(subjectId));

  return (
    <section className="mx-auto mt-8 w-full max-w-[1240px] px-5 sm:px-8 lg:px-10">
      {/* Mobile: horizontal compact layout */}
      <div className="flex gap-5 lg:hidden">
        <div className="w-[120px] shrink-0">
          <div className="aspect-[2/3] overflow-hidden rounded-[20px] shadow-[var(--shadow-warm-sm)]">
            <BookCover
              src={movieDetail.coverUrl ?? fallbackMovie?.coverUrl ?? null}
              title={movieDetail.title ?? fallbackMovie?.title ?? "未知影片"}
              className="rounded-[20px]"
            />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <MobileHeroPanel movieDetail={movieDetail} fallbackMovie={fallbackMovie} />
        </div>
      </div>

      {/* Desktop: original two-column layout */}
      <div className="hidden lg:grid lg:grid-cols-[320px_1fr] lg:items-start lg:gap-10">
        <DetailCoverPanel movieDetail={movieDetail} fallbackMovie={fallbackMovie} />
        <div className="space-y-10">
          <DetailHeroPanel movieDetail={movieDetail} fallbackMovie={fallbackMovie} />
          <div className="grid gap-8 lg:grid-cols-[1.45fr_0.95fr]">
            <DetailDescriptionPanel movieDetail={movieDetail} />
            <DetailSidebarPanel movieDetail={movieDetail} fallbackMovie={fallbackMovie} />
          </div>
        </div>
      </div>

      {/* Mobile: content panels below the hero */}
      <div className="mt-10 space-y-8 lg:hidden">
        <div className="grid gap-8">
          <DetailDescriptionPanel movieDetail={movieDetail} />
          <DetailSidebarPanel movieDetail={movieDetail} fallbackMovie={fallbackMovie} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page shell                                                         */
/* ------------------------------------------------------------------ */

export function MovieDetailPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const fallbackMovie = state.movie;

  if (!subjectId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-center">
        <div>
          <p className="text-lg text-[var(--foreground)]">未找到该影片，可能链接已失效。</p>
          <Link to="/">
            <Button variant="outline" className="mt-6">
              返回搜索
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] pb-16 text-[var(--foreground)]">
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

      <QueryErrorBoundary
        fallback={({ error, reset }) => (
          <DetailErrorFallback error={error} reset={reset} />
        )}
      >
        <Suspense fallback={<MovieDetailSkeleton fallbackMovie={fallbackMovie} />}>
          <MovieDetailContent subjectId={subjectId} fallbackMovie={fallbackMovie} />
        </Suspense>
      </QueryErrorBoundary>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Content panels                                                     */
/* ------------------------------------------------------------------ */

function DetailCoverPanel({
  movieDetail,
  fallbackMovie
}: {
  movieDetail?: MovieDetail;
  fallbackMovie?: SearchMovie;
}) {
  const title = movieDetail?.title ?? fallbackMovie?.title ?? "未知影片";
  const cover = movieDetail?.coverUrl ?? fallbackMovie?.coverUrl ?? null;

  return (
    <div className="mx-auto aspect-[2/3] w-full max-w-[320px] overflow-hidden rounded-[28px] shadow-[var(--shadow-warm-lg)]">
      <BookCover src={cover} title={title} className="rounded-[28px]" />
    </div>
  );
}

function DetailHeroPanel({
  movieDetail,
  fallbackMovie
}: {
  movieDetail: MovieDetail;
  fallbackMovie?: SearchMovie;
}) {
  const directors = movieDetail.director?.length
    ? movieDetail.director
    : fallbackMovie?.director ?? [];
  const cast = movieDetail.cast ?? fallbackMovie?.cast ?? [];
  const isTV = movieDetail.type === "tv";

  return (
    <div>
      <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
        {isTV ? "电视剧详情" : "电影详情"}
      </p>
      <h1 className="mt-3 max-w-4xl font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl">
        {movieDetail?.title ?? fallbackMovie?.title ?? "未知影片"}
      </h1>

      {movieDetail.originalTitle ? (
        <p className="mt-2 text-lg text-[var(--muted-foreground)]">{movieDetail.originalTitle}</p>
      ) : null}

      {directors.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <span className="text-sm text-[var(--muted-foreground)]">导演</span>
          {directors.map((director) => (
            <span
              key={director}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/[0.06] px-3 py-1 text-sm font-medium text-[var(--primary)]"
            >
              <Clapperboard className="size-3.5" />
              {director}
            </span>
          ))}
        </div>
      )}

      {cast.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <span className="text-sm text-[var(--muted-foreground)]">主演</span>
          {cast.slice(0, 5).map((actor) => (
            <span
              key={actor}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/40 px-3 py-1 text-sm text-[var(--foreground)]"
            >
              <Users className="size-3.5" />
              {actor}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {movieDetail.year || fallbackMovie?.year ? (
          <Badge className="gap-2">
            <CalendarDays className="size-3.5" />
            {movieDetail.year ?? fallbackMovie?.year}
          </Badge>
        ) : null}
        {isTV ? (
          <Badge className="gap-2">
            <Tv className="size-3.5" />
            {movieDetail.episode ? `${movieDetail.episode} 集` : "电视剧"}
          </Badge>
        ) : (
          <Badge className="gap-2">
            <Film className="size-3.5" />
            电影
          </Badge>
        )}
        {movieDetail.runtime ? (
          <Badge className="gap-2">
            <Clock className="size-3.5" />
            {movieDetail.runtime}
          </Badge>
        ) : null}
        {movieDetail.ratingsAverage || fallbackMovie?.ratingsAverage ? (
          <Badge variant="accent" className="gap-2">
            <Star className="size-3.5 fill-current" />
            {(movieDetail.ratingsAverage ?? fallbackMovie?.ratingsAverage)?.toFixed(1)}
          </Badge>
        ) : null}
      </div>

      {movieDetail.honorInfos?.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {movieDetail.honorInfos.map((honor) => (
            <Badge key={honor.title} variant="accent" className="gap-1.5">
              #{honor.rank} {honor.title}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DetailDescriptionPanel({ movieDetail }: { movieDetail: MovieDetail }) {
  const description = movieDetail.description || "";

  return (
    <article className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-7 shadow-[var(--shadow-warm-md)]">
      <h2 className="font-display text-2xl font-medium sm:text-3xl">剧情简介</h2>
      <ExpandableDescription
        text={description || "当前来源没有提供简介信息。你可以在豆瓣查看更多详情。"}
      />
    </article>
  );
}

function DetailSidebarPanel({
  movieDetail,
  fallbackMovie
}: {
  movieDetail: MovieDetail;
  fallbackMovie?: SearchMovie;
}) {
  const subjects = (movieDetail.subjects ?? []).slice(0, 12);
  const genres = movieDetail.genre ?? fallbackMovie?.genre ?? [];

  return (
    <aside className="space-y-6">
      {genres.length > 0 && (
        <section className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-6">
          <h3 className="font-display text-xl font-medium sm:text-2xl">类型</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {genres.map((genre) => <Badge key={genre}>{genre}</Badge>)}
          </div>
        </section>
      )}

      {subjects.length > 0 && (
        <section className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-6">
          <h3 className="font-display text-xl font-medium sm:text-2xl">标签</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {subjects.map((subject) => <Badge key={subject}>{subject}</Badge>)}
          </div>
        </section>
      )}

      <section className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-6">
        <h3 className="font-display text-xl font-medium sm:text-2xl">影片信息</h3>
        <div className="mt-4 space-y-4">
          {movieDetail.country?.length ? (
            <InfoBlock label="制片国家/地区" value={movieDetail.country.join(" / ")} />
          ) : null}
          {movieDetail.language?.length ? (
            <InfoBlock label="语言" value={movieDetail.language.join(" / ")} />
          ) : null}
          {movieDetail.releaseDate ? (
            <InfoBlock label="上映日期" value={movieDetail.releaseDate} />
          ) : null}
          {movieDetail.runtime ? (
            <InfoBlock label="片长" value={movieDetail.runtime} />
          ) : null}
          {movieDetail.screenwriter?.length ? (
            <InfoBlock label="编剧" value={movieDetail.screenwriter.join(" / ")} />
          ) : null}
          {movieDetail.imdbId ? (
            <InfoBlock label="IMDb" value={movieDetail.imdbId} />
          ) : null}
          {movieDetail.infoLink ? (
            <a
              href={movieDetail.infoLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)]"
            >
              查看豆瓣详情
              <ExternalLink className="size-4" />
            </a>
          ) : null}
        </div>
      </section>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function ExpandableDescription({ text }: { text: string }) {
  const shouldCollapse = text.length > 420;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-4">
      <div className={`relative ${!expanded && shouldCollapse ? "max-h-[28rem] overflow-hidden" : ""}`}>
        <p className="whitespace-pre-line text-[15px] leading-7 text-[var(--muted-foreground)]">{text}</p>
        {!expanded && shouldCollapse ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.1)_28%,rgba(255,255,255,0.45)_72%,rgba(255,255,255,0.6))]">
            <div className="absolute inset-x-0 bottom-0 h-10 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.55))]" />
          </div>
        ) : null}
      </div>

      {shouldCollapse ? (
        <button
          type="button"
          className="mt-5 inline-flex rounded-full border border-[var(--border)] bg-white/75 px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--primary)]/35 hover:bg-white"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      ) : null}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-base font-semibold">{label}</p>
      <p className="mt-1 text-sm leading-7 text-[var(--muted-foreground)]">{value}</p>
    </div>
  );
}

function MobileHeroPanel({
  movieDetail,
  fallbackMovie
}: {
  movieDetail: MovieDetail;
  fallbackMovie?: SearchMovie;
}) {
  const title = movieDetail?.title ?? fallbackMovie?.title ?? "未知影片";
  const directors = movieDetail.director?.length
    ? movieDetail.director
    : fallbackMovie?.director ?? [];
  const isTV = movieDetail.type === "tv";

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
      {directors.length > 0 && (
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          导演: {directors.slice(0, 2).join(" / ")}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {movieDetail.year || fallbackMovie?.year ? (
          <Badge className="gap-1.5 text-xs">
            <CalendarDays className="size-3" />
            {movieDetail.year ?? fallbackMovie?.year}
          </Badge>
        ) : null}
        <Badge className="gap-1.5 text-xs">
          {isTV ? <Tv className="size-3" /> : <Film className="size-3" />}
          {isTV ? (movieDetail.episode ? `${movieDetail.episode} 集` : "电视剧") : "电影"}
        </Badge>
        {movieDetail.ratingsAverage || fallbackMovie?.ratingsAverage ? (
          <Badge variant="accent" className="gap-1.5 text-xs">
            <Star className="size-3 fill-current" />
            {(movieDetail.ratingsAverage ?? fallbackMovie?.ratingsAverage)?.toFixed(1)}
          </Badge>
        ) : null}
      </div>

      {movieDetail.honorInfos?.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {movieDetail.honorInfos.map((honor) => (
            <Badge key={honor.title} variant="accent" className="gap-1 text-xs">
              #{honor.rank} {honor.title}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton sub-components                                            */
/* ------------------------------------------------------------------ */

function MobileHeroSkeleton({ fallbackMovie }: { fallbackMovie?: SearchMovie }) {
  return (
    <div>
      {fallbackMovie?.title ? (
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{fallbackMovie.title}</h1>
      ) : (
        <div className="space-y-2">
          <div className="h-9 w-full max-w-[16rem] animate-pulse rounded-full bg-white/70" />
          <div className="h-9 w-full max-w-[10rem] animate-pulse rounded-full bg-white/70" />
        </div>
      )}
      {fallbackMovie?.director?.length ? (
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          导演: {fallbackMovie.director.join(" / ")}
        </p>
      ) : (
        <div className="mt-3 h-5 w-32 animate-pulse rounded-full bg-white/70" />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="h-7 w-20 animate-pulse rounded-full bg-white/70" />
        <div className="h-7 w-16 animate-pulse rounded-full bg-white/70" />
      </div>
    </div>
  );
}

function CoverPanelSkeleton({
  title,
  coverUrl
}: {
  title?: string;
  coverUrl?: string;
}) {
  return (
    <div className="mx-auto aspect-[2/3] w-full max-w-[320px] overflow-hidden rounded-[28px] shadow-[var(--shadow-warm-lg)]">
      {coverUrl ? (
        <BookCover src={coverUrl} title={title ?? "海报"} className="rounded-[28px] opacity-70 saturate-75" />
      ) : (
        <div className="h-full w-full animate-pulse rounded-[28px] bg-white/70" />
      )}
    </div>
  );
}

function HeroPanelSkeleton({ fallbackMovie }: { fallbackMovie?: SearchMovie }) {
  return (
    <div>
      <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted-foreground)]">影片详情</p>
      {fallbackMovie?.title ? (
        <h1 className="mt-3 max-w-4xl font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl">{fallbackMovie.title}</h1>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="h-14 w-full max-w-[34rem] animate-pulse rounded-full bg-white/70" />
          <div className="h-14 w-full max-w-[22rem] animate-pulse rounded-full bg-white/70" />
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <div className="h-8 w-32 animate-pulse rounded-full bg-[var(--primary)]/[0.06]" />
        <div className="h-8 w-24 animate-pulse rounded-full bg-[var(--primary)]/[0.06]" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2.5">
        <div className="h-7 w-20 animate-pulse rounded-full bg-white/70" />
        <div className="h-7 w-16 animate-pulse rounded-full bg-white/70" />
        <div className="h-7 w-14 animate-pulse rounded-full bg-white/70" />
      </div>
    </div>
  );
}

function DescriptionPanelSkeleton() {
  return (
    <article className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-7 shadow-[var(--shadow-warm-md)]">
      <h2 className="font-display text-2xl font-medium sm:text-3xl">剧情简介</h2>
      <div className="mt-6 space-y-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className={`h-6 animate-pulse rounded-full bg-white/70 ${
              index === 7 ? "w-2/3" : "w-full"
            }`}
          />
        ))}
      </div>
    </article>
  );
}

function SidebarPanelSkeleton() {
  return (
    <aside className="space-y-6">
      <section className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-6">
        <h3 className="font-display text-xl font-medium sm:text-2xl">类型</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-8 w-16 animate-pulse rounded-full bg-white/70" />
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-6">
        <h3 className="font-display text-xl font-medium sm:text-2xl">影片信息</h3>
        <div className="mt-4 space-y-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-5 w-24 animate-pulse rounded-full bg-white/70" />
              <div className="h-5 w-full animate-pulse rounded-full bg-white/70" />
            </div>
          ))}
          <div className="h-5 w-32 animate-pulse rounded-full bg-white/70" />
        </div>
      </section>
    </aside>
  );
}
