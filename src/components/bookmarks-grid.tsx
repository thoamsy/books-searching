import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Film, User } from "lucide-react";
import { DepthLink } from "@/components/depth-link";
import { BookCover } from "@/components/book-cover";
import { TiltCard } from "@/components/tilt-card";
import { CollectionCover } from "@/components/collection-cover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BookmarkItem } from "@/lib/bookmark-queries";

const EXPANSION_STORAGE_KEY = "opus-bookmarks-expanded";

type SectionKey = "persons" | "books" | "movies" | "collections";

const PERSON_PEEK = 9; // collapsed: 9 avatars + 1 "+N" pill = 2 rows × 5
const COVER_PEEK = 6; // collapsed: 2 rows × 3

function readPersistedExpansion(): Set<SectionKey> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(EXPANSION_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as SectionKey[];
    return new Set(parsed.filter((key): key is SectionKey =>
      key === "persons" || key === "books" || key === "movies" || key === "collections"
    ));
  } catch {
    return new Set();
  }
}

function persistExpansion(set: Set<SectionKey>) {
  try {
    window.sessionStorage.setItem(EXPANSION_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // Storage unavailable (private mode, quota). Fail silently — non-critical.
  }
}

function useBookmarksExpansion() {
  // Sync init so first paint matches the persisted state — critical for
  // vertical scroll restoration to land on the correct Y.
  const [expanded, setExpanded] = useState<Set<SectionKey>>(readPersistedExpansion);

  const toggle = useCallback((key: SectionKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persistExpansion(next);
      return next;
    });
  }, []);

  return { expanded, toggle };
}

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
    case "collection":
      return `/collection/${item.item_id}`;
  }
}

function BookmarkCard({ item }: { item: BookmarkItem }) {
  const variant = item.item_type === "book" ? "book" : "poster";
  const aspect = item.item_type === "book" ? "3/4" : "2/3";

  return (
    <DepthLink to={bookmarkUrl(item)} className="group">
      <TiltCard
        variant={variant}
        className="overflow-hidden rounded-lg border border-border-edge bg-surface/70 shadow-warm-sm transition-shadow group-hover:shadow-warm-md"
        style={{ aspectRatio: aspect }}
      >
        {item.item_cover_url ? (
          variant === "book" ? (
            <BookCover src={item.item_cover_url} title={item.item_title} className="rounded-lg" loading="lazy" />
          ) : (
            <img src={item.item_cover_url} alt={item.item_title} className="h-full w-full rounded-lg object-cover" loading="lazy" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-b from-surface to-muted">
            <Film className="size-10 text-muted-foreground" />
          </div>
        )}
      </TiltCard>
      <div className="mt-2 px-0.5">
        <p className="truncate text-sm font-normal text-foreground">{item.item_title}</p>
      </div>
    </DepthLink>
  );
}

function ExpandToggle({
  isExpanded,
  total,
  unit,
  onToggle,
  className,
}: {
  isExpanded: boolean;
  total: number;
  unit: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "mt-4 block w-full border-t border-border-edge pt-3 text-left text-xs uppercase tracking-[0.28em] text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none",
        className
      )}
      aria-expanded={isExpanded}
    >
      {isExpanded ? "收起" : `展开全部 · ${total} ${unit}`}
    </button>
  );
}

const entrance = { duration: 0.4, ease: [0, 0, 0.58, 1] as const };

export function BookmarksGrid({ items, animate = false }: { items: BookmarkItem[]; animate?: boolean }) {
  const { expanded, toggle } = useBookmarksExpansion();

  const { persons, books, movies, collections } = useMemo(() => {
    const result = { persons: [] as BookmarkItem[], books: [] as BookmarkItem[], movies: [] as BookmarkItem[], collections: [] as BookmarkItem[] };
    for (const item of items) {
      if (item.item_type === "author" || item.item_type === "celebrity") result.persons.push(item);
      else if (item.item_type === "book") result.books.push(item);
      else if (item.item_type === "movie") result.movies.push(item);
      else if (item.item_type === "collection") result.collections.push(item);
    }
    return result;
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border-edge bg-surface px-8 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          还没有收藏，浏览作品时点击星标即可收藏
        </p>
      </div>
    );
  }

  // Build ordered list of visible sections for stagger delay
  const sectionOrder: string[] = [];
  if (persons.length > 0) sectionOrder.push("persons");
  if (books.length > 0) sectionOrder.push("books");
  if (movies.length > 0) sectionOrder.push("movies");
  if (collections.length > 0) sectionOrder.push("collections");

  function sectionProps(key: string) {
    if (!animate) return {};
    const index = sectionOrder.indexOf(key);
    return {
      initial: { opacity: 0, y: 12 } as const,
      animate: { opacity: 1, y: 0 } as const,
      transition: { ...entrance, delay: 0.16 + index * 0.08 },
    };
  }

  const personsExpanded = expanded.has("persons");
  const personsHasOverflow = persons.length > PERSON_PEEK + 1;
  const visiblePersons = personsExpanded || !personsHasOverflow ? persons : persons.slice(0, PERSON_PEEK);

  const booksExpanded = expanded.has("books");
  const booksHasOverflow = books.length > COVER_PEEK;
  const visibleBooks = booksExpanded || !booksHasOverflow ? books : books.slice(0, COVER_PEEK);

  const moviesExpanded = expanded.has("movies");
  const moviesHasOverflow = movies.length > COVER_PEEK;
  const visibleMovies = moviesExpanded || !moviesHasOverflow ? movies : movies.slice(0, COVER_PEEK);

  const collectionsExpanded = expanded.has("collections");
  const collectionsHasOverflow = collections.length > COVER_PEEK;
  const visibleCollections = collectionsExpanded || !collectionsHasOverflow ? collections : collections.slice(0, COVER_PEEK);

  return (
    <div className="flex flex-col gap-6 sm:gap-10">
      {persons.length > 0 ? (
        <motion.section className="flex flex-col gap-5" {...sectionProps("persons")}>
          <h2 className="text-xs uppercase tracking-[0.28em] text-muted-foreground">收藏影人 / 作者</h2>

          {/* Mobile: avatar wrap grid, names dropped, "+N" pill as overflow entry */}
          <div className="sm:hidden">
            <div className="flex flex-wrap gap-3">
              {visiblePersons.map((item) => (
                <DepthLink
                  key={item.item_id}
                  to={bookmarkUrl(item)}
                  className="group block"
                  aria-label={item.item_title}
                  title={item.item_title}
                >
                  <div className="size-14 overflow-hidden rounded-full border-2 border-border-edge shadow-warm-sm transition-shadow group-hover:shadow-warm-md">
                    {item.item_cover_url ? (
                      <img src={item.item_cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-surface to-accent">
                        <User className="size-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </DepthLink>
              ))}
              {!personsExpanded && personsHasOverflow ? (
                <button
                  type="button"
                  onClick={() => toggle("persons")}
                  className="flex size-14 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong text-xs font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                  aria-label={`查看其余 ${persons.length - PERSON_PEEK} 位影人`}
                  aria-expanded={false}
                >
                  +{persons.length - PERSON_PEEK}
                </button>
              ) : null}
            </div>
            {personsExpanded && personsHasOverflow ? (
              <ExpandToggle isExpanded total={persons.length} unit="位" onToggle={() => toggle("persons")} />
            ) : null}
          </div>

          {/* Desktop: stacked avatars with hover expand */}
          <TooltipProvider delayDuration={150}>
            <div className="group/stack hidden items-center sm:flex">
              <div className="flex items-center">
                {persons.map((item, index) => (
                  <Tooltip key={item.item_id}>
                    <TooltipTrigger asChild>
                      <DepthLink
                        to={bookmarkUrl(item)}
                        className="relative block shrink-0 transition-[margin] duration-300 ease-out hover:!z-50 group-hover/stack:mr-2"
                        style={{ marginLeft: index === 0 ? 0 : "-0.75rem", zIndex: persons.length - index }}
                      >
                        <div className="size-10 overflow-hidden rounded-full border-2 border-background shadow-sm transition-transform duration-200 hover:scale-110">
                          {item.item_cover_url ? (
                            <img src={item.item_cover_url} alt={item.item_title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-surface to-accent text-xs font-medium text-muted-foreground">
                              {item.item_title.replace(/[\[\]（）()【】\s]/g, "").charAt(0)}
                            </div>
                          )}
                        </div>
                      </DepthLink>
                    </TooltipTrigger>
                    <TooltipContent>{item.item_title}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </TooltipProvider>
        </motion.section>
      ) : null}

      {books.length > 0 ? (
        <motion.section className="flex flex-col gap-5" {...sectionProps("books")}>
          <h2 className="text-xs uppercase tracking-[0.28em] text-muted-foreground">收藏书籍</h2>
          {/* Mobile: 3-col grid, peek 6, inline expand */}
          <div className="sm:hidden">
            <div className="grid grid-cols-3 gap-3">
              {visibleBooks.map((item) => (
                <BookmarkCard key={item.item_id} item={item} />
              ))}
            </div>
            {booksHasOverflow ? (
              <ExpandToggle
                isExpanded={booksExpanded}
                total={books.length}
                unit="本"
                onToggle={() => toggle("books")}
              />
            ) : null}
          </div>
          {/* Desktop: grid */}
          <div className="hidden grid-cols-3 gap-3 @2xl:grid-cols-4 sm:grid">
            {books.map((item) => (
              <BookmarkCard key={item.item_id} item={item} />
            ))}
          </div>
        </motion.section>
      ) : null}

      {movies.length > 0 ? (
        <motion.section className="flex flex-col gap-5" {...sectionProps("movies")}>
          <h2 className="text-xs uppercase tracking-[0.28em] text-muted-foreground">收藏影视</h2>
          {/* Mobile: 3-col grid, peek 6, inline expand */}
          <div className="sm:hidden">
            <div className="grid grid-cols-3 gap-3">
              {visibleMovies.map((item) => (
                <BookmarkCard key={item.item_id} item={item} />
              ))}
            </div>
            {moviesHasOverflow ? (
              <ExpandToggle
                isExpanded={moviesExpanded}
                total={movies.length}
                unit="部"
                onToggle={() => toggle("movies")}
              />
            ) : null}
          </div>
          {/* Desktop: grid */}
          <div className="hidden grid-cols-3 gap-3 @2xl:grid-cols-4 sm:grid">
            {movies.map((item) => (
              <BookmarkCard key={item.item_id} item={item} />
            ))}
          </div>
        </motion.section>
      ) : null}

      {collections.length > 0 ? (
        <motion.section className="flex flex-col gap-5 lg:hidden" {...sectionProps("collections")}>
          <h2 className="text-xs uppercase tracking-[0.28em] text-muted-foreground">收藏榜单</h2>
          {/* Mobile only: desktop shows collections in aside */}
          <div>
            <div className="grid grid-cols-3 gap-3">
              {visibleCollections.map((item) => (
                <DepthLink key={item.item_id} to={`/collection/${item.item_id}`} className="group">
                  <CollectionCover
                    urls={item.item_cover_urls ?? []}
                    title={item.item_title}
                    className="transition-shadow group-hover:shadow-warm-md"
                  />
                  <div className="mt-2 px-0.5">
                    <p className="truncate text-sm font-normal text-foreground">{item.item_title}</p>
                  </div>
                </DepthLink>
              ))}
            </div>
            {collectionsHasOverflow ? (
              <ExpandToggle
                isExpanded={collectionsExpanded}
                total={collections.length}
                unit="个"
                onToggle={() => toggle("collections")}
              />
            ) : null}
          </div>
        </motion.section>
      ) : null}
    </div>
  );
}
