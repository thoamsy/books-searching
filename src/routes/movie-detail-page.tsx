import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  CalendarDays,
  Clapperboard,
  Clock,
  ExternalLink,
  Film,
  Star,
  Tv,
  Users
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { DepthLink } from "@/components/depth-link";
import { BookCover } from "@/components/book-cover";
import { DetailErrorFallback } from "@/components/detail-error-fallback";
import { ExpandableDescription, InfoBlock } from "@/components/expandable-description";
import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { movieDetailQueryOptions } from "@/lib/movie-queries";
import { cn } from "@/lib/utils";
import type { CreditPerson, MovieDetail, SearchMovie } from "@/types/movies";

interface LocationState {
  movie?: SearchMovie;
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
          <div className="aspect-[2/3] overflow-hidden rounded-lg">
            {fallbackMovie?.coverUrl ? (
              <BookCover src={fallbackMovie.coverUrl} title={fallbackMovie?.title ?? "海报"} className="rounded-lg opacity-70 saturate-75" />
            ) : (
              <Skeleton className="h-full w-full rounded-lg bg-white/70" />
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
        <div className="flex flex-col gap-10">
          <HeroPanelSkeleton fallbackMovie={fallbackMovie} />
          <div className="grid gap-8 lg:grid-cols-[1.45fr_0.95fr]">
            <DescriptionPanelSkeleton />
            <SidebarPanelSkeleton />
          </div>
        </div>
      </div>

      {/* Mobile content skeleton */}
      <div className="animate-fade-up mt-6 flex flex-col gap-6 [animation-delay:160ms] lg:hidden">
        <div className="grid gap-6">
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
          <div className="aspect-[2/3] overflow-hidden rounded-lg shadow-warm-sm">
            <BookCover
              src={movieDetail.coverUrl ?? fallbackMovie?.coverUrl ?? null}
              title={movieDetail.title ?? fallbackMovie?.title ?? "未知影片"}
              className="rounded-lg"
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
        <div className="flex flex-col gap-10">
          <DetailHeroPanel movieDetail={movieDetail} fallbackMovie={fallbackMovie} />
          <div className="grid gap-8 lg:grid-cols-[1.45fr_0.95fr]">
            <DetailDescriptionPanel movieDetail={movieDetail} />
            <DetailSidebarPanel movieDetail={movieDetail} fallbackMovie={fallbackMovie} />
          </div>
        </div>
      </div>

      {/* Mobile: content panels below the hero */}
      <div className="mt-6 flex flex-col gap-6 lg:hidden">
        <div className="grid gap-6">
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
  const fallbackMovie = (useLocation().state as LocationState | null)?.movie;

  if (!subjectId) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div>
          <p className="text-lg text-foreground">未找到该影片，可能链接已失效。</p>
          <Link to="/">
            <Button variant="outline" className="mt-6">
              返回搜索
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <QueryErrorBoundary
      fallback={({ error, reset }) => (
        <DetailErrorFallback error={error} reset={reset} entityLabel="影片详情" />
      )}
    >
      <Suspense fallback={<MovieDetailSkeleton fallbackMovie={fallbackMovie} />}>
        <MovieDetailContent subjectId={subjectId} fallbackMovie={fallbackMovie} />
      </Suspense>
    </QueryErrorBoundary>
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
    <div className="mx-auto aspect-[2/3] w-full max-w-[320px] overflow-hidden rounded-lg shadow-warm-lg">
      <BookCover src={cover} title={title} className="rounded-lg" />
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
    : (fallbackMovie?.director?.map((name): CreditPerson => ({ name })) ?? []);
  const cast = movieDetail.cast?.length
    ? movieDetail.cast
    : (fallbackMovie?.cast?.map((name): CreditPerson => ({ name })) ?? []);
  const isTV = movieDetail.type === "tv";

  return (
    <div>
      <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">
        {isTV ? "电视剧详情" : "电影详情"}
      </p>
      <h1 className="mt-3 max-w-4xl font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl">
        {movieDetail?.title ?? fallbackMovie?.title ?? "未知影片"}
      </h1>

      {movieDetail.originalTitle ? (
        <p className="mt-2 text-lg text-muted-foreground">{movieDetail.originalTitle}</p>
      ) : null}

      {directors.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <span className="text-sm text-muted-foreground">导演</span>
          {directors.map((person) => (
            <DepthLink
              key={person.name}
              to={person.id ? `/celebrity/${person.id}` : `/?q=${encodeURIComponent(person.name)}`}
              className="group/person inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.06] px-3 py-1 text-sm font-medium text-primary shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-primary/[0.1] hover:shadow-[0_4px_12px_color-mix(in_oklch,var(--primary)_12%,transparent)]"
            >
              <Clapperboard className="size-3.5" />
              <span className="bg-[linear-gradient(var(--primary),var(--primary))] bg-[length:0%_1.5px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 ease-out group-hover/person:bg-[length:100%_1.5px]">
                {person.name}
              </span>
            </DepthLink>
          ))}
        </div>
      )}

      {cast.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <span className="text-sm text-muted-foreground">主演</span>
          {cast.slice(0, 5).map((person) => (
            <DepthLink
              key={person.name}
              to={person.id ? `/celebrity/${person.id}` : `/?q=${encodeURIComponent(person.name)}`}
              className="group/person inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/40 px-3 py-1 text-sm text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-px hover:border-white/80 hover:bg-white/60 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
            >
              <Users className="size-3.5" />
              <span className="bg-[linear-gradient(var(--foreground),var(--foreground))] bg-[length:0%_1.5px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 ease-out group-hover/person:bg-[length:100%_1.5px]">
                {person.name}
              </span>
            </DepthLink>
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
          {movieDetail.honorInfos.map((honor) =>
            honor.collectionId ? (
              <DepthLink key={honor.title} to={`/collection/${honor.collectionId}`}>
                <Badge variant="accent" className="gap-1.5 cursor-pointer transition-colors hover:bg-accent">
                  #{honor.rank} {honor.title}
                </Badge>
              </DepthLink>
            ) : (
              <Badge key={honor.title} variant="accent" className="gap-1.5">
                #{honor.rank} {honor.title}
              </Badge>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

function DetailDescriptionPanel({ movieDetail }: { movieDetail: MovieDetail }) {
  const description = movieDetail.description || "";

  return (
    <article className="rounded-lg border border-white/70 bg-surface p-7 shadow-warm-md">
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
    <aside className="flex flex-col gap-6">
      {genres.length > 0 && (
        <section className="rounded-lg border border-white/70 bg-surface p-6">
          <h3 className="font-display text-xl font-medium sm:text-2xl">类型</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {genres.map((genre) => <Badge key={genre}>{genre}</Badge>)}
          </div>
        </section>
      )}

      {subjects.length > 0 && (
        <section className="rounded-lg border border-white/70 bg-surface p-6">
          <h3 className="font-display text-xl font-medium sm:text-2xl">标签</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {subjects.map((subject) => <Badge key={subject}>{subject}</Badge>)}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-white/70 bg-surface p-6">
        <h3 className="font-display text-xl font-medium sm:text-2xl">影片信息</h3>
        <div className="mt-4 flex flex-col gap-4">
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
            <InfoBlock label="编剧" value={movieDetail.screenwriter.map((p) => p.name).join(" / ")} />
          ) : null}
          {movieDetail.imdbId ? (
            <InfoBlock label="IMDb" value={movieDetail.imdbId} />
          ) : null}
          {movieDetail.infoLink ? (
            <a
              href={movieDetail.infoLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              查看豆瓣详情
              <ExternalLink className="size-4" />
            </a>
          ) : null}
        </div>
      </section>

      {movieDetail.subjectCollections?.length ? (
        <section className="rounded-lg border border-white/70 bg-surface p-6">
          <h3 className="font-display text-xl font-medium sm:text-2xl">上榜</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {movieDetail.subjectCollections.map((c) => (
              <DepthLink key={c.id} to={`/collection/${c.id}`}>
                <Badge className="cursor-pointer transition-colors hover:bg-accent">
                  {c.title}
                </Badge>
              </DepthLink>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

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
    : (fallbackMovie?.director?.map((name): CreditPerson => ({ name })) ?? []);
  const cast = movieDetail.cast?.length
    ? movieDetail.cast
    : (fallbackMovie?.cast?.map((name): CreditPerson => ({ name })) ?? []);
  const isTV = movieDetail.type === "tv";

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h1>

      {directors.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">导演</span>
          {directors.slice(0, 2).map((person) => (
            <DepthLink
              key={person.name}
              to={person.id ? `/celebrity/${person.id}` : `/?q=${encodeURIComponent(person.name)}`}
              className="group/person inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/[0.06] px-2.5 py-0.5 text-xs font-medium text-primary transition-all hover:border-primary/40 hover:bg-primary/[0.1]"
            >
              <Clapperboard className="size-3" />
              <span className="bg-[linear-gradient(var(--primary),var(--primary))] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 ease-out group-hover/person:bg-[length:100%_1px]">
                {person.name}
              </span>
            </DepthLink>
          ))}
        </div>
      )}

      {cast.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">主演</span>
          {cast.slice(0, 3).map((person) => (
            <DepthLink
              key={person.name}
              to={person.id ? `/celebrity/${person.id}` : `/?q=${encodeURIComponent(person.name)}`}
              className="group/person inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/40 px-2.5 py-0.5 text-xs text-foreground transition-all hover:border-white/80 hover:bg-white/60"
            >
              <Users className="size-3" />
              <span className="bg-[linear-gradient(var(--foreground),var(--foreground))] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 ease-out group-hover/person:bg-[length:100%_1px]">
                {person.name}
              </span>
            </DepthLink>
          ))}
        </div>
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
          {movieDetail.honorInfos.map((honor) =>
            honor.collectionId ? (
              <DepthLink key={honor.title} to={`/collection/${honor.collectionId}`}>
                <Badge variant="accent" className="gap-1 text-xs cursor-pointer transition-colors hover:bg-accent">
                  #{honor.rank} {honor.title}
                </Badge>
              </DepthLink>
            ) : (
              <Badge key={honor.title} variant="accent" className="gap-1 text-xs">
                #{honor.rank} {honor.title}
              </Badge>
            )
          )}
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
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full max-w-[16rem] rounded-full bg-white/70" />
          <Skeleton className="h-9 w-full max-w-[10rem] rounded-full bg-white/70" />
        </div>
      )}
      {fallbackMovie?.director?.length ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">导演</span>
          {fallbackMovie.director.slice(0, 2).map((name) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/[0.06] px-2.5 py-0.5 text-xs font-medium text-primary">
              {name}
            </span>
          ))}
        </div>
      ) : (
        <Skeleton className="mt-3 h-5 w-32 rounded-full bg-white/70" />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Skeleton className="h-7 w-20 rounded-full bg-white/70" />
        <Skeleton className="h-7 w-16 rounded-full bg-white/70" />
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
    <div className="mx-auto aspect-[2/3] w-full max-w-[320px] overflow-hidden rounded-lg shadow-warm-lg">
      {coverUrl ? (
        <BookCover src={coverUrl} title={title ?? "海报"} className="rounded-lg opacity-70 saturate-75" />
      ) : (
        <Skeleton className="h-full w-full rounded-lg bg-white/70" />
      )}
    </div>
  );
}

function HeroPanelSkeleton({ fallbackMovie }: { fallbackMovie?: SearchMovie }) {
  return (
    <div>
      <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">影片详情</p>
      {fallbackMovie?.title ? (
        <h1 className="mt-3 max-w-4xl font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl">{fallbackMovie.title}</h1>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-14 w-full max-w-[34rem] rounded-full bg-white/70" />
          <Skeleton className="h-14 w-full max-w-[22rem] rounded-full bg-white/70" />
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <Skeleton className="h-8 w-32 rounded-full bg-primary/[0.06]" />
        <Skeleton className="h-8 w-24 rounded-full bg-primary/[0.06]" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2.5">
        <Skeleton className="h-7 w-20 rounded-full bg-white/70" />
        <Skeleton className="h-7 w-16 rounded-full bg-white/70" />
        <Skeleton className="h-7 w-14 rounded-full bg-white/70" />
      </div>
    </div>
  );
}

function DescriptionPanelSkeleton() {
  return (
    <article className="rounded-lg border border-white/70 bg-surface p-7 shadow-warm-md">
      <h2 className="font-display text-2xl font-medium sm:text-3xl">剧情简介</h2>
      <div className="mt-6 flex flex-col gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn("h-6 rounded-full bg-white/70", index === 7 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
    </article>
  );
}

function SidebarPanelSkeleton() {
  return (
    <aside className="flex flex-col gap-6">
      <section className="rounded-lg border border-white/70 bg-surface p-6">
        <h3 className="font-display text-xl font-medium sm:text-2xl">类型</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-16 rounded-full bg-white/70" />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/70 bg-surface p-6">
        <h3 className="font-display text-xl font-medium sm:text-2xl">影片信息</h3>
        <div className="mt-4 flex flex-col gap-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-5 w-24 rounded-full bg-white/70" />
              <Skeleton className="h-5 w-full rounded-full bg-white/70" />
            </div>
          ))}
          <Skeleton className="h-5 w-32 rounded-full bg-white/70" />
        </div>
      </section>
    </aside>
  );
}
