import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CalendarDays, ExternalLink, LoaderCircle, Star, UserRound } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { BookCover } from "@/components/book-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBookDetail, getCoverUrl, getTextValue } from "@/lib/books-api";
import type { BookDetail, SearchBook } from "@/types/books";

interface LocationState {
  book?: SearchBook;
}

export function BookDetailPage() {
  const { workId } = useParams();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const fallbackBook = state.book;
  const [bookDetail, setBookDetail] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchQuery = new URLSearchParams(location.search).get("q") ?? "";

  useEffect(() => {
    if (!workId) {
      setError("缺少书籍标识。");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    getBookDetail(workId)
      .then((detail) => {
        if (cancelled) {
          return;
        }

        setBookDetail(detail);
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message =
            fetchError instanceof Error && fetchError.message.includes("rate-limited")
              ? "豆瓣详情页当前触发了风控或频率限制，请稍后重试。"
              : "书籍详情获取失败，请稍后重试。";
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workId]);

  const title = bookDetail?.title ?? fallbackBook?.title ?? "未知书名";
  const description = getTextValue(bookDetail?.description) || fallbackBook?.description || "";
  const cover = useMemo(
    () => getCoverUrl(bookDetail?.coverUrl ?? fallbackBook?.coverUrl),
    [bookDetail?.coverUrl, fallbackBook?.coverUrl]
  );
  const subjects = (bookDetail?.subjects ?? fallbackBook?.subject ?? []).slice(0, 12);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="flex items-center gap-3 text-[var(--muted-foreground)]">
          <LoaderCircle className="size-5 animate-spin" />
          正在加载详情...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-center">
        <div>
          <p className="text-lg text-[var(--primary)]">{error}</p>
          <Link to={searchQuery ? `/?q=${encodeURIComponent(searchQuery)}` : "/"}>
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
      <div className="mx-auto w-full max-w-[1240px] px-5 pt-6 sm:px-8 lg:px-10">
        <Link
          to={searchQuery ? `/?q=${encodeURIComponent(searchQuery)}` : "/"}
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-sm text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="size-4" />
          返回检索
        </Link>
      </div>

      <section className="mx-auto mt-8 grid w-full max-w-[1240px] gap-10 px-5 sm:px-8 lg:grid-cols-[320px_1fr] lg:items-start lg:px-10">
        <div className="animate-[rise_0.6s_ease_forwards]">
          <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[36px] border border-white/70 bg-white/60 p-4 shadow-[0_28px_70px_rgba(95,66,43,0.12)]">
            <div className="aspect-[3/4] overflow-hidden rounded-[28px]">
              <BookCover src={cover} title={title} />
            </div>
          </div>
        </div>

        <div className="animate-[rise_0.68s_ease_forwards] [animation-delay:120ms]">
          <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Book Detail</p>
          <h1 className="mt-3 max-w-4xl font-display text-5xl leading-none sm:text-6xl">{title}</h1>

          <div className="mt-5 flex flex-wrap gap-3">
            {bookDetail?.authors?.length ? (
              <Badge className="gap-2">
                <UserRound className="size-3.5" />
                {bookDetail.authors.join(" / ")}
              </Badge>
            ) : fallbackBook?.authorName?.length ? (
              <Badge className="gap-2">
                <UserRound className="size-3.5" />
                {fallbackBook.authorName.join(" / ")}
              </Badge>
            ) : null}
            {bookDetail?.firstPublishDate || fallbackBook?.firstPublishYear ? (
              <Badge className="gap-2">
                <CalendarDays className="size-3.5" />
                {bookDetail?.firstPublishDate ?? fallbackBook?.firstPublishYear}
              </Badge>
            ) : null}
            {bookDetail?.pageCount || fallbackBook?.pageCount ? (
              <Badge className="gap-2">
                <BookOpen className="size-3.5" />
                {(fallbackBook?.pageCount ?? bookDetail?.pageCount ?? "页数未知")} pages
              </Badge>
            ) : null}
            {bookDetail?.ratingsAverage ? (
              <Badge variant="accent" className="gap-2">
                <Star className="size-3.5 fill-current" />
                {bookDetail.ratingsAverage.toFixed(1)}
              </Badge>
            ) : null}
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1.45fr_0.95fr]">
            <article className="rounded-[32px] border border-white/70 bg-white/60 p-7 shadow-[0_24px_60px_rgba(76,54,39,0.08)]">
              <h2 className="font-display text-3xl">内容简介</h2>
              <p className="mt-4 whitespace-pre-line text-base leading-8 text-[var(--muted-foreground)]">
                {description || "当前来源没有提供简介信息。你可以返回搜索查看更多相关版本。"}
              </p>
            </article>

            <aside className="space-y-5">
              <section className="rounded-[32px] border border-white/70 bg-white/60 p-6">
                <h3 className="font-display text-2xl">主题标签</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {subjects.length ? subjects.map((subject) => <Badge key={subject}>{subject}</Badge>) : <p className="text-sm text-[var(--muted-foreground)]">暂无主题标签。</p>}
                </div>
              </section>

              <section className="rounded-[32px] border border-white/70 bg-white/60 p-6">
                <h3 className="font-display text-2xl">书目信息</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-base font-semibold">出版社</p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {bookDetail?.publisher ?? fallbackBook?.publisher ?? "暂无出版社信息"}
                    </p>
                  </div>
                  <div>
                    <p className="text-base font-semibold">页数</p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {bookDetail?.pageCount ?? fallbackBook?.pageCount ?? "暂无页数信息"}
                    </p>
                  </div>
                  <div>
                    <p className="text-base font-semibold">标识符</p>
                    <p className="mt-1 text-sm leading-7 text-[var(--muted-foreground)]">
                      {bookDetail?.identifiers?.length ? bookDetail.identifiers.join(" / ") : "暂无 ISBN 等标识信息"}
                    </p>
                  </div>
                  {bookDetail?.infoLink ? (
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
          </div>
        </div>
      </section>
    </main>
  );
}
