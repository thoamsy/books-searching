import { Star } from "lucide-react";
import { Link } from "react-router-dom";
import { BookCover } from "@/components/book-cover";

interface MediaCardProps {
  to: string;
  coverUrl: string | null;
  title: string;
  subtitle?: string;
  rating?: number;
  rank?: number;
  /** react-router location state passed to Link */
  state?: unknown;
}

export function MediaCard({
  to,
  coverUrl,
  title,
  subtitle,
  rating,
  rank,
  state
}: MediaCardProps) {
  return (
    <Link to={to} state={state} className="group flex flex-col gap-2.5">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-[var(--muted)] shadow-[var(--shadow-warm-sm)] transition-shadow group-hover:shadow-[var(--shadow-warm-md)]">
        <BookCover
          src={coverUrl}
          title={title}
          className="rounded-2xl transition-transform group-hover:scale-105"
          loading="lazy"
        />
        {rank != null ? (
          <span className="absolute left-2.5 top-2.5 flex size-7 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white backdrop-blur-sm">
            {rank}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5 px-0.5">
        <h3 className="line-clamp-1 text-sm font-medium leading-snug">
          {title}
        </h3>
        {subtitle ? (
          <p className="line-clamp-1 text-xs text-[var(--muted-foreground)]">
            {subtitle}
          </p>
        ) : null}
        {rating ? (
          <div className="flex items-center gap-1 pt-0.5">
            <Star className="size-3 fill-current text-amber-500" />
            <span className="text-xs font-medium">{rating.toFixed(1)}</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
