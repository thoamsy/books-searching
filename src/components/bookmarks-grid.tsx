import { Film, User } from "lucide-react";
import { DepthLink } from "@/components/depth-link";
import { BookCover } from "@/components/book-cover";
import { TiltCard } from "@/components/tilt-card";
import type { BookmarkItem } from "@/lib/bookmark-queries";

function bookmarkUrl(item: BookmarkItem): string {
  switch (item.item_type) {
    case "book":
      return `/book/${item.item_id}`;
    case "movie":
      return `/movie/${item.item_id}`;
    case "celebrity":
      return `/celebrity/${item.item_id}`;
    case "author":
      return `/author/${encodeURIComponent(item.item_id)}`;
  }
}

function BookmarkCard({ item }: { item: BookmarkItem }) {
  const isPerson = item.item_type === "author" || item.item_type === "celebrity";

  if (isPerson) {
    return (
      <DepthLink to={bookmarkUrl(item)} className="group flex flex-col items-center gap-2.5">
        <div className="size-20 overflow-hidden rounded-full border-2 border-white/80 shadow-warm-sm transition-shadow group-hover:shadow-warm-md sm:size-24">
          {item.item_cover_url ? (
            <img src={item.item_cover_url} alt={item.item_title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-white/80 to-accent">
              <User className="size-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <p className="max-w-full truncate text-center text-sm font-medium">{item.item_title}</p>
      </DepthLink>
    );
  }

  const variant = item.item_type === "book" ? "book" : "poster";
  const aspect = item.item_type === "book" ? "3/4" : "2/3";

  return (
    <DepthLink to={bookmarkUrl(item)} className="group">
      <TiltCard
        variant={variant}
        className="overflow-hidden rounded-lg border border-white/60 bg-white/40 shadow-warm-sm transition-shadow group-hover:shadow-warm-md"
        style={{ aspectRatio: aspect }}
      >
        {item.item_cover_url ? (
          variant === "book" ? (
            <BookCover src={item.item_cover_url} title={item.item_title} className="rounded-lg" loading="lazy" />
          ) : (
            <img src={item.item_cover_url} alt={item.item_title} className="h-full w-full rounded-lg object-cover" loading="lazy" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(231,211,185,0.94))]">
            <Film className="size-10 text-muted-foreground" />
          </div>
        )}
      </TiltCard>
      <div className="mt-2 px-0.5">
        <p className="truncate text-sm font-medium text-foreground">{item.item_title}</p>
      </div>
    </DepthLink>
  );
}

export function BookmarksGrid({ items }: { items: BookmarkItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-white/70 bg-surface px-8 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          还没有收藏，浏览作品时点击星标即可收藏
        </p>
      </div>
    );
  }

  const persons = items.filter((i) => i.item_type === "author" || i.item_type === "celebrity");
  const media = items.filter((i) => i.item_type === "book" || i.item_type === "movie");

  return (
    <div className="flex flex-col gap-10">
      {persons.length > 0 ? (
        <section>
          <h2 className="mb-5 text-xs uppercase tracking-[0.28em] text-muted-foreground">收藏影人 / 作者</h2>
          <div className="flex flex-wrap gap-6">
            {persons.map((item) => (
              <BookmarkCard key={item.item_id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {media.length > 0 ? (
        <section>
          {persons.length > 0 ? (
            <h2 className="mb-5 text-xs uppercase tracking-[0.28em] text-muted-foreground">收藏作品</h2>
          ) : null}
          {/* Mobile: horizontal scroll with snap */}
          <div className="-mr-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pr-5 sm:hidden">
            {media.map((item) => (
              <div key={item.item_id} className="w-[calc((100%-0.75rem*2)/3.4)] shrink-0 snap-start">
                <BookmarkCard item={item} />
              </div>
            ))}
          </div>
          {/* Desktop: grid */}
          <div className="hidden grid-cols-3 gap-3 @2xl:grid-cols-4 sm:grid">
            {media.map((item) => (
              <BookmarkCard key={item.item_id} item={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
