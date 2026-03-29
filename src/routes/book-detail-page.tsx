import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ExternalLink,
  RotateCw,
  Star,
  UserRound
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { BookCover } from "@/components/book-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCoverUrl, getTextValue } from "@/lib/books-api";
import { bookDetailQueryOptions } from "@/lib/book-queries";
import type { BookDetail, SearchBook } from "@/types/books";

interface LocationState {
  book?: SearchBook;
}

export function BookDetailPage() {
  const { workId } = useParams();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const fallbackBook = state.book;
  const searchQuery = new URLSearchParams(location.search).get("q") ?? "";

  const detailQuery = useQuery({
    ...bookDetailQueryOptions(workId ?? ""),
    enabled: Boolean(workId),
    throwOnError: false
  });

  if (!workId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-center">
        <div>
          <p className="text-lg text-[var(--foreground)]">未找到该书籍，可能链接已失效。</p>
          <Link to="/">
            <Button variant="outline" className="mt-6">
              返回搜索
            </Button>
          </Link>
        </div>
      </main>
    );
  }
  const errorMessage =
    detailQuery.error instanceof Error
      ? detailQuery.error.message.includes("rate-limited")
        ? "豆瓣详情页当前触发了风控或频率限制，请稍后重试。"
        : "书籍详情获取失败，请稍后重试。"
      : "";

  return (
    <main className="min-h-screen bg-[var(--background)] pb-16 text-[var(--foreground)]">
      <div className="animate-fade-up mx-auto w-full max-w-[1240px] px-5 pt-6 sm:px-8 lg:px-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-sm text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="size-4" />
          返回检索
        </Link>
      </div>

      {errorMessage ? (
        <div className="mx-auto mt-10 w-full max-w-[1240px] px-5 text-center sm:px-8 lg:px-10">
          <div className="rounded-[32px] border border-white/70 bg-[var(--surface)] px-8 py-12">
            <p className="text-lg text-[var(--destructive)]">{errorMessage}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button variant="outline" onClick={() => detailQuery.refetch()}>
                <RotateCw className="size-4" />
                重试
              </Button>
              <Link to="/">
                <Button variant="ghost">
                  返回搜索
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <section className="mx-auto mt-8 w-full max-w-[1240px] px-5 sm:px-8 lg:px-10">
          {/* Mobile: horizontal compact layout */}
          <div className="animate-fade-up flex gap-5 [animation-delay:80ms] lg:hidden">
            <div className="w-[120px] shrink-0">
              {detailQuery.isPending ? (
                <div className="aspect-[3/4] overflow-hidden rounded-[20px]">
                  {fallbackBook?.coverUrl ? (
                    <BookCover src={fallbackBook.coverUrl} title={fallbackBook?.title ?? "封面"} className="rounded-[20px] opacity-70 saturate-75" />
                  ) : (
                    <div className="h-full w-full animate-pulse rounded-[20px] bg-white/70" />
                  )}
                </div>
              ) : (
                <div className="aspect-[3/4] overflow-hidden rounded-[20px] shadow-[var(--shadow-warm-sm)]">
                  <BookCover
                    src={getCoverUrl(detailQuery.data!.coverUrl ?? fallbackBook?.coverUrl)}
                    title={detailQuery.data!.title ?? fallbackBook?.title ?? "未知书名"}
                    className="rounded-[20px]"
                  />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              {detailQuery.isPending ? (
                <MobileHeroSkeleton fallbackBook={fallbackBook} />
              ) : (
                <MobileHeroPanel bookDetail={detailQuery.data!} fallbackBook={fallbackBook} />
              )}
            </div>
          </div>

          {/* Desktop: original two-column layout */}
          <div className="animate-fade-up hidden [animation-delay:80ms] lg:grid lg:grid-cols-[320px_1fr] lg:items-start lg:gap-10">
          {detailQuery.isPending ? (
            <CoverPanelSkeleton title={fallbackBook?.title} coverUrl={fallbackBook?.coverUrl} />
          ) : (
            <DetailCoverPanel bookDetail={detailQuery.data!} fallbackBook={fallbackBook} />
          )}

          <div className="space-y-10">
            {detailQuery.isPending ? (
              <HeroPanelSkeleton fallbackBook={fallbackBook} />
            ) : (
              <DetailHeroPanel bookDetail={detailQuery.data!} fallbackBook={fallbackBook} />
            )}

            <div className="grid gap-8 lg:grid-cols-[1.45fr_0.95fr]">
              {detailQuery.isPending ? (
                <DescriptionPanelSkeleton />
              ) : (
                <DetailDescriptionPanel bookDetail={detailQuery.data!} fallbackBook={fallbackBook} />
              )}

              {detailQuery.isPending ? (
                <SidebarPanelSkeleton />
              ) : (
                <DetailSidebarPanel bookDetail={detailQuery.data!} fallbackBook={fallbackBook} />
              )}
            </div>
          </div>
          </div>

          {/* Mobile: content panels below the hero */}
          <div className="animate-fade-up mt-8 space-y-8 [animation-delay:160ms] lg:hidden">
            <div className="grid gap-8">
              {detailQuery.isPending ? (
                <DescriptionPanelSkeleton />
              ) : (
                <DetailDescriptionPanel bookDetail={detailQuery.data!} fallbackBook={fallbackBook} />
              )}

              {detailQuery.isPending ? (
                <SidebarPanelSkeleton />
              ) : (
                <DetailSidebarPanel bookDetail={detailQuery.data!} fallbackBook={fallbackBook} />
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

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
    <div className="mx-auto aspect-[3/4] w-full max-w-[320px] overflow-hidden rounded-[28px] shadow-[var(--shadow-warm-lg)]">
      <BookCover src={cover} title={title} className="rounded-[28px]" />
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
  return (
    <div>
      <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted-foreground)]">书籍详情</p>
      <h1 className="mt-3 max-w-4xl font-display text-5xl leading-none sm:text-6xl">
        {bookDetail?.title ?? fallbackBook?.title ?? "未知书名"}
      </h1>

      <div className="mt-5 flex flex-wrap gap-3">
        {bookDetail.authors?.length ? (
          bookDetail.authors.map((author) => (
            <Link key={author} to={`/?q=${encodeURIComponent(author)}`}>
              <Badge className="gap-2 transition hover:border-[var(--primary)]/35 hover:bg-white">
                <UserRound className="size-3.5" />
                {author}
              </Badge>
            </Link>
          ))
        ) : fallbackBook?.authorName?.length ? (
          fallbackBook.authorName.map((author) => (
            <Link key={author} to={`/?q=${encodeURIComponent(author)}`}>
              <Badge className="gap-2 transition hover:border-[var(--primary)]/35 hover:bg-white">
                <UserRound className="size-3.5" />
                {author}
              </Badge>
            </Link>
          ))
        ) : null}
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
  const description = getTextValue(bookDetail.description) || fallbackBook?.description || "";

  return (
    <article className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-7 shadow-[var(--shadow-warm-md)]">
      <h2 className="font-display text-3xl">内容简介</h2>
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
    <aside className="space-y-5">
      <section className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-6">
        <h3 className="font-display text-2xl">主题标签</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {subjects.length ? (
            subjects.map((subject) => <Badge key={subject}>{subject}</Badge>)
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">暂无主题标签。</p>
          )}
        </div>
      </section>

      <section className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-6">
        <h3 className="font-display text-2xl">书目信息</h3>
        <div className="mt-4 space-y-4">
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
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)]"
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

function ExpandableDescription({ text }: { text: string }) {
  const shouldCollapse = text.length > 420;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-4">
      <div className={`relative ${!expanded && shouldCollapse ? "max-h-[28rem] overflow-hidden" : ""}`}>
        <p className="whitespace-pre-line text-base leading-8 text-[var(--muted-foreground)]">{text}</p>
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
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {authors.slice(0, 3).join(" / ")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
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
    </div>
  );
}

function MobileHeroSkeleton({ fallbackBook }: { fallbackBook?: SearchBook }) {
  return (
    <div>
      {fallbackBook?.title ? (
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{fallbackBook.title}</h1>
      ) : (
        <div className="space-y-2">
          <div className="h-9 w-full max-w-[16rem] animate-pulse rounded-full bg-white/70" />
          <div className="h-9 w-full max-w-[10rem] animate-pulse rounded-full bg-white/70" />
        </div>
      )}
      {fallbackBook?.authorName?.length ? (
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {fallbackBook.authorName.join(" / ")}
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
    <div className="mx-auto aspect-[3/4] w-full max-w-[320px] overflow-hidden rounded-[28px] shadow-[var(--shadow-warm-lg)]">
      {coverUrl ? (
        <BookCover src={coverUrl} title={title ?? "封面"} className="rounded-[28px] opacity-70 saturate-75" />
      ) : (
        <div className="h-full w-full animate-pulse rounded-[28px] bg-white/70" />
      )}
    </div>
  );
}

function HeroPanelSkeleton({ fallbackBook }: { fallbackBook?: SearchBook }) {
  return (
    <div>
      <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted-foreground)]">书籍详情</p>
      {fallbackBook?.title ? (
        <h1 className="mt-3 max-w-4xl font-display text-5xl leading-none sm:text-6xl">{fallbackBook.title}</h1>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="h-14 w-full max-w-[34rem] animate-pulse rounded-full bg-white/70" />
          <div className="h-14 w-full max-w-[22rem] animate-pulse rounded-full bg-white/70" />
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        {fallbackBook?.authorName?.length ? (
          <Badge className="gap-2">
            <UserRound className="size-3.5" />
            {fallbackBook.authorName.join(" / ")}
          </Badge>
        ) : (
          <>
            <div className="h-10 w-40 animate-pulse rounded-full bg-white/70" />
            <div className="h-10 w-28 animate-pulse rounded-full bg-white/70" />
            <div className="h-10 w-32 animate-pulse rounded-full bg-white/70" />
          </>
        )}
      </div>
    </div>
  );
}

function DescriptionPanelSkeleton() {
  return (
    <article className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-7 shadow-[var(--shadow-warm-md)]">
      <h2 className="font-display text-3xl">内容简介</h2>
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
    <aside className="space-y-5">
      <section className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-6">
        <h3 className="font-display text-2xl">主题标签</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-8 w-20 animate-pulse rounded-full bg-white/70" />
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-6">
        <h3 className="font-display text-2xl">书目信息</h3>
        <div className="mt-4 space-y-5">
          {Array.from({ length: 3 }).map((_, index) => (
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
