import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  BookOpen,
  CalendarDays,
  ExternalLink,
  Star,
  UserRound
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
import { getCoverUrl } from "@/lib/books-api";
import { bookDetailQueryOptions } from "@/lib/book-queries";
import { cn } from "@/lib/utils";
import type { BookDetail, SearchBook } from "@/types/books";

interface LocationState {
  book?: SearchBook;
}

/* ------------------------------------------------------------------ */
/*  Skeleton fallback                                                  */
/* ------------------------------------------------------------------ */

function BookDetailSkeleton({ fallbackBook }: { fallbackBook?: SearchBook }) {
  return (
    <section className="mx-auto mt-8 w-full max-w-[1240px] px-5 sm:px-8 lg:px-10">
      {/* Mobile skeleton */}
      <div className="animate-fade-up flex gap-5 [animation-delay:80ms] lg:hidden">
        <div className="w-[120px] shrink-0">
          <div className="aspect-[3/4] overflow-hidden rounded-lg">
            {fallbackBook?.coverUrl ? (
              <BookCover src={fallbackBook.coverUrl} title={fallbackBook?.title ?? "封面"} className="rounded-lg opacity-70 saturate-75" />
            ) : (
              <Skeleton className="h-full w-full rounded-lg bg-white/70" />
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <MobileHeroSkeleton fallbackBook={fallbackBook} />
        </div>
      </div>

      {/* Desktop skeleton */}
      <div className="animate-fade-up hidden [animation-delay:80ms] lg:grid lg:grid-cols-[320px_1fr] lg:items-start lg:gap-10">
        <CoverPanelSkeleton title={fallbackBook?.title} coverUrl={fallbackBook?.coverUrl} />
        <div className="flex flex-col gap-10">
          <HeroPanelSkeleton fallbackBook={fallbackBook} />
          <div className="grid items-start gap-8 lg:grid-cols-[1.45fr_0.95fr]">
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

function BookDetailContent({ workId, fallbackBook }: { workId: string; fallbackBook?: SearchBook }) {
  const { data: bookDetail } = useSuspenseQuery(bookDetailQueryOptions(workId));

  return (
    <section className="mx-auto mt-8 w-full max-w-[1240px] px-5 sm:px-8 lg:px-10">
      {/* Mobile: horizontal compact layout */}
      <div className="flex gap-5 lg:hidden">
        <div className="w-[120px] shrink-0">
          <div className="aspect-[3/4] overflow-hidden rounded-lg shadow-warm-sm">
            <BookCover
              src={getCoverUrl(bookDetail.coverUrl ?? fallbackBook?.coverUrl)}
              title={bookDetail.title ?? fallbackBook?.title ?? "未知书名"}
              className="rounded-lg"
            />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <MobileHeroPanel bookDetail={bookDetail} fallbackBook={fallbackBook} />
        </div>
      </div>

      {/* Desktop: original two-column layout */}
      <div className="hidden lg:grid lg:grid-cols-[320px_1fr] lg:items-start lg:gap-10">
        <DetailCoverPanel bookDetail={bookDetail} fallbackBook={fallbackBook} />
        <div className="flex flex-col gap-10">
          <DetailHeroPanel bookDetail={bookDetail} fallbackBook={fallbackBook} />
          <div className="grid items-start gap-8 lg:grid-cols-[1.45fr_0.95fr]">
            <DetailDescriptionPanel bookDetail={bookDetail} fallbackBook={fallbackBook} />
            <DetailSidebarPanel bookDetail={bookDetail} fallbackBook={fallbackBook} />
          </div>
        </div>
      </div>

      {/* Mobile: content panels below the hero */}
      <div className="mt-6 flex flex-col gap-6 lg:hidden">
        <div className="grid gap-6">
          <DetailDescriptionPanel bookDetail={bookDetail} fallbackBook={fallbackBook} />
          <DetailSidebarPanel bookDetail={bookDetail} fallbackBook={fallbackBook} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page shell                                                         */
/* ------------------------------------------------------------------ */

export function BookDetailPage() {
  const { workId } = useParams();
  const fallbackBook = (useLocation().state as LocationState | null)?.book;

  if (!workId) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div>
          <p className="text-lg text-foreground">未找到该书籍，可能链接已失效。</p>
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
        <DetailErrorFallback error={error} reset={reset} entityLabel="书籍详情" />
      )}
    >
      <Suspense fallback={<BookDetailSkeleton fallbackBook={fallbackBook} />}>
        <BookDetailContent workId={workId} fallbackBook={fallbackBook} />
      </Suspense>
    </QueryErrorBoundary>
  );
}

/* ------------------------------------------------------------------ */
/*  Content panels                                                     */
/* ------------------------------------------------------------------ */

function DetailCoverPanel({
  bookDetail,
  fallbackBook
}: {
  bookDetail?: BookDetail;
  fallbackBook?: SearchBook;
}) {
  const title = bookDetail?.title ?? fallbackBook?.title ?? "未知书名";
  const cover = getCoverUrl(bookDetail?.coverUrl ?? fallbackBook?.coverUrl);

  return (
    <div className="mx-auto aspect-[3/4] w-full max-w-[320px] overflow-hidden rounded-lg shadow-warm-lg">
      <BookCover src={cover} title={title} className="rounded-lg" />
    </div>
  );
}

function DetailHeroPanel({
  bookDetail,
  fallbackBook
}: {
  bookDetail: BookDetail;
  fallbackBook?: SearchBook;
}) {
  const authors = bookDetail.authors?.length
    ? bookDetail.authors
    : fallbackBook?.authorName ?? [];

  return (
    <div>
      <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">书籍详情</p>
      <h1 className="mt-3 max-w-4xl font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl">
        {bookDetail?.title ?? fallbackBook?.title ?? "未知书名"}
      </h1>

      {authors.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {authors.map((author) => (
            <DepthLink
              key={author}
              to={`/author/${encodeURIComponent(author)}`}
              className="group/author inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.06] px-3 py-1 text-sm font-medium text-primary shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-primary/[0.1] hover:shadow-[0_4px_12px_color-mix(in_oklch,var(--primary)_12%,transparent)]"
            >
              <UserRound className="size-3.5" />
              <span className="bg-[linear-gradient(var(--primary),var(--primary))] bg-[length:0%_1.5px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 ease-out group-hover/author:bg-[length:100%_1.5px]">
                {author}
              </span>
            </DepthLink>
          ))}
        </div>
      )}

      {bookDetail.translator?.length ? (
        <p className="mt-2 text-sm text-muted-foreground">
          译者: {bookDetail.translator.join(" / ")}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {bookDetail.firstPublishDate || fallbackBook?.firstPublishYear ? (
          <Badge className="gap-2">
            <CalendarDays className="size-3.5" />
            {bookDetail.firstPublishDate ?? fallbackBook?.firstPublishYear}
          </Badge>
        ) : null}
        {bookDetail.pageCount || fallbackBook?.pageCount ? (
          <Badge className="gap-2">
            <BookOpen className="size-3.5" />
            {(bookDetail.pageCount ?? fallbackBook?.pageCount ?? "页数未知")} 页
          </Badge>
        ) : null}
        {bookDetail.ratingsAverage || fallbackBook?.ratingsAverage ? (
          <Badge variant="accent" className="gap-2">
            <Star className="size-3.5 fill-current" />
            {(bookDetail.ratingsAverage ?? fallbackBook?.ratingsAverage)?.toFixed(1)}
          </Badge>
        ) : null}
      </div>

      {bookDetail.honorInfos?.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {bookDetail.honorInfos.map((honor) =>
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

function DetailDescriptionPanel({
  bookDetail,
  fallbackBook
}: {
  bookDetail: BookDetail;
  fallbackBook?: SearchBook;
}) {
  const description = bookDetail.description || fallbackBook?.description || "";

  return (
    <article className="rounded-lg border border-white/70 bg-surface p-7 shadow-warm-md lg:sticky lg:top-4 lg:self-start">
      <h2 className="font-display text-2xl font-medium sm:text-3xl">内容简介</h2>
      <ExpandableDescription
        text={description || "当前来源没有提供简介信息。你可以返回搜索查看更多相关版本。"}
      />
    </article>
  );
}

function DetailSidebarPanel({
  bookDetail,
  fallbackBook
}: {
  bookDetail: BookDetail;
  fallbackBook?: SearchBook;
}) {
  const subjects = (bookDetail.subjects ?? fallbackBook?.subject ?? []).slice(0, 12);

  return (
    <aside className="flex flex-col gap-6 lg:sticky lg:top-4 lg:self-start">
      <section className="rounded-lg border border-white/70 bg-surface p-6">
        <h3 className="font-display text-xl font-medium sm:text-2xl">主题标签</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {subjects.length ? (
            subjects.map((subject) => <Badge key={subject}>{subject}</Badge>)
          ) : (
            <p className="text-sm text-muted-foreground">暂无主题标签。</p>
          )}
        </div>
      </section>

      {bookDetail.subjectCollections?.length ? (
        <section className="rounded-lg border border-white/70 bg-surface p-6">
          <h3 className="font-display text-xl font-medium sm:text-2xl">上榜</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {bookDetail.subjectCollections.map((c) => (
              <DepthLink key={c.id} to={`/collection/${c.id}`}>
                <Badge className="cursor-pointer transition-colors hover:bg-accent">
                  {c.title}
                </Badge>
              </DepthLink>
            ))}
          </div>
        </section>
      ) : null}

      {bookDetail.catalog ? (
        <section className="rounded-lg border border-white/70 bg-surface p-6">
          <h3 className="font-display text-xl font-medium sm:text-2xl">目录</h3>
          <ExpandableDescription text={bookDetail.catalog} />
        </section>
      ) : null}

      <section className="rounded-lg border border-white/70 bg-surface p-6">
        <h3 className="font-display text-xl font-medium sm:text-2xl">书目信息</h3>
        <div className="mt-4 flex flex-col gap-4">
          <InfoBlock label="出版社" value={bookDetail.publisher ?? fallbackBook?.publisher ?? "暂无出版社信息"} />
          <InfoBlock label="页数" value={bookDetail.pageCount ?? fallbackBook?.pageCount ?? "暂无页数信息"} />
          <InfoBlock
            label="标识符"
            value={bookDetail.identifiers?.length ? bookDetail.identifiers.join(" / ") : "暂无 ISBN 等标识信息"}
          />
          {bookDetail.infoLink ? (
            <a
              href={bookDetail.infoLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              查看来源详情
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

function MobileHeroPanel({
  bookDetail,
  fallbackBook
}: {
  bookDetail: BookDetail;
  fallbackBook?: SearchBook;
}) {
  const title = bookDetail?.title ?? fallbackBook?.title ?? "未知书名";
  const authors = bookDetail.authors?.length
    ? bookDetail.authors
    : fallbackBook?.authorName ?? [];

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
      {authors.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {authors.slice(0, 3).map((author) => (
            <DepthLink
              key={author}
              to={`/author/${encodeURIComponent(author)}`}
              className="group/author inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/[0.06] px-2.5 py-0.5 text-xs font-medium text-primary transition-all hover:border-primary/40 hover:bg-primary/[0.1]"
            >
              <UserRound className="size-3" />
              <span className="bg-[linear-gradient(var(--primary),var(--primary))] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 ease-out group-hover/author:bg-[length:100%_1px]">
                {author}
              </span>
            </DepthLink>
          ))}
        </div>
      )}

      {bookDetail.translator?.length ? (
        <p className="mt-1 text-xs text-muted-foreground">
          译者: {bookDetail.translator.join(" / ")}
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {bookDetail.firstPublishDate || fallbackBook?.firstPublishYear ? (
          <Badge className="gap-1.5 text-xs">
            <CalendarDays className="size-3" />
            {bookDetail.firstPublishDate ?? fallbackBook?.firstPublishYear}
          </Badge>
        ) : null}
        {bookDetail.pageCount || fallbackBook?.pageCount ? (
          <Badge className="gap-1.5 text-xs">
            <BookOpen className="size-3" />
            {(bookDetail.pageCount ?? fallbackBook?.pageCount ?? "页数未知")} 页
          </Badge>
        ) : null}
        {bookDetail.ratingsAverage || fallbackBook?.ratingsAverage ? (
          <Badge variant="accent" className="gap-1.5 text-xs">
            <Star className="size-3 fill-current" />
            {(bookDetail.ratingsAverage ?? fallbackBook?.ratingsAverage)?.toFixed(1)}
          </Badge>
        ) : null}
      </div>

      {bookDetail.honorInfos?.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {bookDetail.honorInfos.map((honor) =>
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

function MobileHeroSkeleton({ fallbackBook }: { fallbackBook?: SearchBook }) {
  return (
    <div>
      {fallbackBook?.title ? (
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{fallbackBook.title}</h1>
      ) : (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full max-w-[16rem] rounded-full bg-white/70" />
          <Skeleton className="h-9 w-full max-w-[10rem] rounded-full bg-white/70" />
        </div>
      )}
      {fallbackBook?.authorName?.length ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {fallbackBook.authorName.join(" / ")}
        </p>
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
    <div className="mx-auto aspect-[3/4] w-full max-w-[320px] overflow-hidden rounded-lg shadow-warm-lg">
      {coverUrl ? (
        <BookCover src={coverUrl} title={title ?? "封面"} className="rounded-lg opacity-70 saturate-75" />
      ) : (
        <Skeleton className="h-full w-full rounded-lg bg-white/70" />
      )}
    </div>
  );
}

function HeroPanelSkeleton({ fallbackBook }: { fallbackBook?: SearchBook }) {
  return (
    <div>
      <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">书籍详情</p>
      {fallbackBook?.title ? (
        <h1 className="mt-3 max-w-4xl font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl">{fallbackBook.title}</h1>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-14 w-full max-w-[34rem] rounded-full bg-white/70" />
          <Skeleton className="h-14 w-full max-w-[22rem] rounded-full bg-white/70" />
        </div>
      )}
      {fallbackBook?.authorName?.length ? (
        <div className="mt-5 flex flex-wrap gap-2.5">
          {fallbackBook.authorName.map((author) => (
            <div key={author} className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/[0.04] px-3 py-1 text-sm text-primary/70">
              <UserRound className="size-3.5" />
              {author}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Skeleton className="h-8 w-32 rounded-full bg-primary/[0.06]" />
          <Skeleton className="h-8 w-24 rounded-full bg-primary/[0.06]" />
        </div>
      )}
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
      <h2 className="font-display text-2xl font-medium sm:text-3xl">内容简介</h2>
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
        <h3 className="font-display text-xl font-medium sm:text-2xl">主题标签</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-20 rounded-full bg-white/70" />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/70 bg-surface p-6">
        <h3 className="font-display text-xl font-medium sm:text-2xl">书目信息</h3>
        <div className="mt-4 flex flex-col gap-5">
          {Array.from({ length: 3 }).map((_, index) => (
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
