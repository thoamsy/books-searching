import { ChevronRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { BookCover } from "@/components/book-cover";
import { Badge } from "@/components/ui/badge";
import { getCoverUrl, normalizeWorkId } from "@/lib/books-api";
import type { SearchBook } from "@/types/books";

interface ResultItemProps {
  book: SearchBook;
  query: string;
}

export function ResultItem({ book, query }: ResultItemProps) {
  const workId = normalizeWorkId(book.key);

  return (
    <Link
      to={`/book/${workId}?q=${encodeURIComponent(query)}`}
      state={{ book }}
      className="group grid grid-cols-[84px_1fr_auto] items-center gap-4 rounded-[28px] border border-white/70 bg-white/58 p-3 backdrop-blur-md transition hover:border-[var(--primary)]/40 hover:bg-white/84 hover:shadow-[0_28px_54px_rgba(92,60,40,0.1)]"
    >
      <div className="h-28 w-20 overflow-hidden rounded-[24px]">
        <BookCover src={getCoverUrl(book.coverUrl)} title={book.title} />
      </div>

      <div className="min-w-0">
        <p className="font-display text-2xl leading-none text-[var(--foreground)]">{book.title}</p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {book.authorName.length ? book.authorName.join(" / ") : "作者信息暂缺"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {book.firstPublishYear ? <Badge>{book.firstPublishYear}</Badge> : null}
          {book.pageCount ? <Badge>{book.pageCount} pages</Badge> : null}
          {book.language?.[0] ? <Badge>{book.language[0].toUpperCase()}</Badge> : null}
          {book.ratingsAverage ? (
            <Badge variant="accent" className="gap-1">
              <Star className="size-3 fill-current" />
              {book.ratingsAverage.toFixed(1)}
            </Badge>
          ) : null}
        </div>
      </div>

      <ChevronRight className="size-5 text-[var(--muted-foreground)] transition group-hover:translate-x-1 group-hover:text-[var(--primary)]" />
    </Link>
  );
}
