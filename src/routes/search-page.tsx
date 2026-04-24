import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, Film, LoaderCircle, Search, Tv, User, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { bookmarksQueryOptions } from "@/lib/bookmark-queries";
import { BookmarksGrid } from "@/components/bookmarks-grid";
import { BookCover } from "@/components/book-cover";
import { CollectionCover } from "@/components/collection-cover";
import { DepthLink } from "@/components/depth-link";
import { OpusWordmark } from "@/components/opus-wordmark";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList
} from "@/components/ui/combobox";
import { useDebounce } from "@/hooks/use-debounce";
import { getCoverUrl, normalizeWorkId, suggestItemToSearchBook } from "@/lib/books-api";
import { suggestionsQueryOptions } from "@/lib/book-queries";
import { movieSuggestionsQueryOptions } from "@/lib/movie-queries";
import { suggestItemToSearchMovie } from "@/lib/movies-api";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { useSearchScrollRestoration } from "@/hooks/use-search-scroll-restoration";
import type { SearchBook, SuggestItem } from "@/types/books";
import type { SearchMovie } from "@/types/movies";
import type { MovieSuggestItem } from "@/types/movies";

type SearchOption = {
  id: string;
  label: string;
  meta?: string;
  year?: string;
  kind: "book" | "author" | "movie" | "tv" | "celebrity";
  book?: SearchBook;
  movie?: SearchMovie;
  suggest?: SuggestItem;
  movieSuggest?: MovieSuggestItem;
};

function getSuggestionOptionId(item: SuggestItem, index: number) {
  return `${item.type}::${item.id}::${index}`;
}

function getMovieSuggestionOptionId(item: MovieSuggestItem, index: number) {
  return `movie::${item.id}::${index}`;
}

const getOptionLabel = (item: SearchOption) => item.label;

// Track whether the search page has been mounted before in this session
let hasSearchPageMounted = false;

export function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialQueryFromUrl = new URLSearchParams(location.search).get("q")?.trim() ?? "";
  const [query, setQuery] = useState(initialQueryFromUrl);
  const [isOpen, setIsOpen] = useState(Boolean(initialQueryFromUrl));
  const [isComposing, setIsComposing] = useState(false);
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Only play entrance animations on the very first mount
  const [isFirstVisit] = useState(() => {
    if (hasSearchPageMounted) return false;
    hasSearchPageMounted = true;
    return true;
  });

  const { data: bookmarks = [] } = useQuery(bookmarksQueryOptions(userId));
  useSearchScrollRestoration("home");
  const hasBookmarks = bookmarks.length > 0;
  const collectionBookmarks = useMemo(
    () => bookmarks.filter((b) => b.item_type === "collection"),
    [bookmarks]
  );
  const hasCollections = collectionBookmarks.length > 0;

  const inputRef = useRef<HTMLInputElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 260);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ---------------------------------------------------------------------------
  // Suggestion queries
  // ---------------------------------------------------------------------------
  const suggestionsQuery = useQuery({
    ...suggestionsQueryOptions(debouncedQuery),
    enabled: !isComposing && Boolean(debouncedQuery.trim())
  });

  const movieSuggestionsQuery = useQuery({
    ...movieSuggestionsQueryOptions(debouncedQuery),
    enabled: !isComposing && Boolean(debouncedQuery.trim())
  });

  const suggestItems = suggestionsQuery.data ?? [];
  const movieSuggestItems = movieSuggestionsQuery.data ?? [];
  const isSuggesting = suggestionsQuery.isFetching || movieSuggestionsQuery.isFetching;
  const error =
    (suggestionsQuery.error instanceof Error || movieSuggestionsQuery.error instanceof Error)
      ? (suggestionsQuery.error?.message ?? movieSuggestionsQuery.error?.message ?? "").includes("rate-limited")
        ? "豆瓣当前触发了风控或频率限制，请稍后重试。"
        : "搜索服务暂时不可用，请稍后再试。"
      : "";

  // ---------------------------------------------------------------------------
  // Navigate helpers
  // ---------------------------------------------------------------------------
  function openBookDetail(book: SearchBook, searchQuery: string) {
    const workId = normalizeWorkId(book.key);
    if (!workId) return false;
    setIsOpen(false);
    setIsComposing(false);
    navigate(`/book/${workId}?q=${encodeURIComponent(searchQuery)}`, {
      state: { book, navDepth: 1 }
    });
    return true;
  }

  function openMovieDetail(movie: SearchMovie, searchQuery: string) {
    const subjectId = movie.key;
    if (!subjectId) return false;
    setIsOpen(false);
    setIsComposing(false);
    navigate(`/movie/${subjectId}?q=${encodeURIComponent(searchQuery)}`, {
      state: { movie, navDepth: 1 }
    });
    return true;
  }

  function submitSearch(term: string) {
    const trimmed = term.trim();

    if (isComposing) {
      return;
    }

    if (!trimmed) {
      setQuery("");
      setIsOpen(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    // Try book suggestions first
    const bookItems = suggestItems.filter((item) => item.type === "book");
    const matchedBook = bookItems.find((item) => item.title === trimmed) ?? bookItems[0];

    // Try movie suggestions
    const matchedMovie = movieSuggestItems.find((item) => item.title === trimmed) ?? movieSuggestItems[0];

    // Prefer exact title match
    if (matchedBook?.title === trimmed) {
      openBookDetail(suggestItemToSearchBook(matchedBook), matchedBook.title);
      return;
    }
    if (matchedMovie?.title === trimmed) {
      openMovieDetail(suggestItemToSearchMovie(matchedMovie), matchedMovie.title);
      return;
    }

    // Fall back to first available
    if (matchedBook) {
      openBookDetail(suggestItemToSearchBook(matchedBook), matchedBook.title);
      return;
    }
    if (matchedMovie) {
      openMovieDetail(suggestItemToSearchMovie(matchedMovie), matchedMovie.title);
      return;
    }

    setIsOpen(true);
  }

  const bookSuggestionOptions: SearchOption[] = suggestItems.map(
    (item, index) => ({
      id: getSuggestionOptionId(item, index),
      label: item.title,
      meta:
        item.type === "author"
          ? item.enName ?? "作者"
          : item.authorName || "作者信息暂缺",
      year: item.year ?? "",
      kind: item.type === "author" ? "author" as const : "book" as const,
      book: item.type === "book" ? suggestItemToSearchBook(item) : undefined,
      suggest: item
    })
  );

  const movieSuggestionOptions: SearchOption[] = movieSuggestItems.map(
    (item, index) => ({
      id: getMovieSuggestionOptionId(item, index),
      label: item.title,
      meta: item.type === "celebrity"
        ? (item.subTitle || "影人")
        : (item.subTitle || (item.type === "tv" ? "电视剧" : "电影")),
      year: item.year ?? "",
      kind: item.type === "celebrity" ? "celebrity" as const : item.episode ? "tv" as const : "movie" as const,
      movie: item.type !== "celebrity" ? suggestItemToSearchMovie(item) : undefined,
      movieSuggest: item
    })
  );

  const suggestionOptions = [...bookSuggestionOptions, ...movieSuggestionOptions];
  const comboOpen = isOpen && query.trim().length > 0;

  function handleInputValueChange(nextValue: string) {
    setQuery(nextValue);
  }

  function handleOptionSelect(option: SearchOption | null) {
    if (!option) {
      return;
    }

    if (option.kind === "author" && option.suggest) {
      setIsOpen(false);
      setIsComposing(false);
      const params = new URLSearchParams();
      if (option.suggest.coverUrl) params.set("photo", option.suggest.coverUrl);
      if (option.suggest.enName) params.set("en", option.suggest.enName);
      if (option.suggest.url) params.set("url", option.suggest.url);
      const qs = params.toString();
      navigate(`/author/${encodeURIComponent(option.label)}${qs ? `?${qs}` : ""}`, { state: { navDepth: 1 } });
      return;
    }

    if (option.kind === "celebrity" && option.movieSuggest) {
      setIsOpen(false);
      setIsComposing(false);
      navigate(`/celebrity/${option.movieSuggest.id}`, { state: { navDepth: 1 } });
      return;
    }

    if ((option.kind === "movie" || option.kind === "tv") && option.movie) {
      setQuery(option.label);
      openMovieDetail(option.movie, option.label);
      return;
    }

    setQuery(option.label);
    if (option.book && !openBookDetail(option.book, option.label)) {
      submitSearch(option.label);
    }
  }

  const entrance = { duration: 0.4, ease: [0, 0, 0.58, 1] as const };

  return (
    <main className="flex flex-1 flex-col">
      <div className={cn(
        "mx-auto w-full px-5 sm:px-8",
        hasBookmarks
          ? "max-w-5xl lg:grid lg:grid-cols-[1fr_240px] lg:gap-x-12"
          : "my-auto max-w-3xl"
      )}>
      <motion.div
        layout="position"
        transition={{ layout: { type: "spring", stiffness: 180, damping: 28 } }}
        className={cn(
          "relative w-full",
          hasBookmarks && "pt-6 lg:col-start-1 sm:pt-10"
        )}
      >
        <motion.header
          initial={isFirstVisit ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={entrance}
          className={cn(hasBookmarks ? "mb-10" : "mb-8")}
        >
          <p className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="size-6" />
            <OpusWordmark className="text-xl" />
          </p>
          <h1 className="mt-3 font-display text-4xl font-medium leading-tight sm:text-5xl">
            找到你的<span className="text-primary">下一部作品</span>
          </h1>
        </motion.header>

        <motion.div
          initial={isFirstVisit ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...entrance, delay: 0.08 }}
          ref={searchBarRef}
          className={cn("relative", hasBookmarks ? "mb-14" : "mb-6")}
        >
          <Combobox<SearchOption>
            items={suggestionOptions}
            itemToStringLabel={getOptionLabel}
            itemToStringValue={getOptionLabel}
            inputValue={query}
            open={comboOpen}
            onOpenChange={setIsOpen}
            onInputValueChange={handleInputValueChange}
            onValueChange={handleOptionSelect}
            autoHighlight
          >
            <ComboboxInput
              ref={inputRef}
              showTrigger={false}
              showClear={false}
              aria-label="搜索书籍和影视"
              name="search"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              autoFocus
              placeholder="搜索书名、电影、电视剧……"
              className="h-13 rounded-2xl border-border-edge bg-surface-elevated text-base font-medium shadow-warm-sm backdrop-blur-xl transition-[box-shadow,border-color] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] has-[[data-slot=input-group-control]:focus-visible]:border-primary/25 has-[[data-slot=input-group-control]:focus-visible]:shadow-warm-md has-[[data-slot=input-group-control]:focus-visible]:ring-0 [&_input]:pl-11 placeholder:text-muted-foreground/60"
              onFocus={() => setIsOpen(true)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={(event) => {
                setIsComposing(false);
                setQuery(event.currentTarget.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isComposing) {
                  event.preventDefault();
                  event.stopPropagation();
                  submitSearch(query);
                  return;
                }

                if (event.key === "Escape") {
                  setIsOpen(false);
                  if (query) {
                    setQuery("");
                  }
                }
              }}
            >
              {query ? (
                <button
                  type="button"
                  className="mr-1 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setQuery("");
                    setIsOpen(false);
                    window.requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  aria-label="清除搜索词"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </ComboboxInput>

            <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-primary/60" />

            <ComboboxContent
              anchor={searchBarRef}
              side="bottom"
              sideOffset={8}
              className="w-(--anchor-width) max-w-none min-w-(--anchor-width) rounded-2xl border border-border-edge bg-surface-elevated py-2 shadow-warm-dropdown backdrop-blur-xl"
            >
              <ComboboxGroup>
                <ComboboxLabel className="px-5 py-2 text-left text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  搜索建议
                </ComboboxLabel>
                {isSuggesting && suggestItems.length === 0 ? (
                  <div role="status" aria-live="polite" className="flex items-center gap-2.5 px-5 py-3 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    正在搜索…
                  </div>
                ) : null}
              </ComboboxGroup>

              {!isSuggesting && (
                <ComboboxEmpty className="px-5 py-3 text-sm">没有找到相关结果</ComboboxEmpty>
              )}

              <ComboboxList>
                {(item: SearchOption) => (
                  <ComboboxItem
                    key={item.id}
                    value={item}
                    className="mx-0 flex items-center justify-between gap-4 rounded-lg px-5 py-2.5 data-highlighted:bg-accent/60"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      {item.kind === "author" || item.kind === "celebrity" ? (
                        <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-edge bg-skeleton">
                          {(item.suggest?.coverUrl ?? item.movieSuggest?.coverUrl) ? (
                            <img src={(item.suggest?.coverUrl ?? item.movieSuggest?.coverUrl)!} alt={item.label} className="h-full w-full rounded-lg object-cover" loading="lazy" />
                          ) : (
                            <User className="size-5 text-muted-foreground" />
                          )}
                        </div>
                      ) : (item.kind === "movie" || item.kind === "tv") ? (
                        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-border-edge bg-skeleton">
                          {item.movieSuggest?.coverUrl ? (
                            <img src={item.movieSuggest.coverUrl} alt={item.label} className="h-full w-full rounded-lg object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              {item.kind === "tv" ? <Tv className="size-5 text-muted-foreground" /> : <Film className="size-5 text-muted-foreground" />}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-border-edge bg-skeleton">
                          <BookCover src={getCoverUrl(item.suggest?.coverUrl)} title={item.label} className="rounded-lg" loading="lazy" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.meta}</p>
                      </div>
                    </div>
                    {item.kind === "author" ? (
                      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground">作者</span>
                    ) : item.kind === "celebrity" ? (
                      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground">影人</span>
                    ) : (item.kind === "movie" || item.kind === "tv") ? (
                      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground">
                        {item.kind === "tv" ? "电视剧" : "电影"}{item.year ? ` · ${item.year}` : ""}
                      </span>
                    ) : item.year ? (
                      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground">
                        书籍 · {item.year}
                      </span>
                    ) : null}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>

          {error ? (
            <div role="alert" className="mt-4 flex items-center gap-3">
              <p className="text-sm text-destructive">{error}</p>
              <button
                type="button"
                className="shrink-0 text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition hover:decoration-foreground"
                onClick={() => suggestionsQuery.refetch()}
              >
                重试
              </button>
            </div>
          ) : null}
        </motion.div>

      </motion.div>

      {hasBookmarks ? (
        <div className="@container pb-20 lg:col-start-1">
          <BookmarksGrid items={bookmarks} animate={isFirstVisit} />
        </div>
      ) : null}

      {hasBookmarks ? (
        <motion.aside
          initial={isFirstVisit ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...entrance, delay: 0.16 }}
          className="hidden lg:sticky lg:top-10 lg:col-start-2 lg:row-start-2 lg:block"
        >
          <h2 className="text-xs uppercase tracking-[0.28em] text-muted-foreground">收藏榜单</h2>
          {hasCollections ? (
            <div className="mt-5 flex flex-col gap-6">
              {collectionBookmarks.map((item) => (
                <DepthLink key={item.item_id} to={`/collection/${item.item_id}`} className="group">
                  <CollectionCover
                    urls={item.item_cover_urls ?? []}
                    title={item.item_title}
                    className="transition-shadow group-hover:shadow-warm-md"
                  />
                  <p className="mt-2.5 truncate text-sm font-medium text-foreground">{item.item_title}</p>
                </DepthLink>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <div className="flex h-20 items-end gap-1">
                {[
                  { w: "w-3.5", bg: "bg-primary/15", h: "h-full" },
                  { w: "w-2.5", bg: "bg-primary/25", h: "h-[85%]" },
                  { w: "w-4",   bg: "bg-primary/10", h: "h-[92%]" },
                  { w: "w-2",   bg: "bg-primary/20", h: "h-[78%]" },
                  { w: "w-3",   bg: "bg-primary/12", h: "h-[88%]" },
                ].map(({ w, bg, h }, i) => (
                  <div key={i} className={cn(w, bg, h, "rounded-sm")} />
                ))}
              </div>
              <p className="mt-4 font-display text-sm text-muted-foreground/70">
                收藏的榜单会出现在这里
              </p>
            </div>
          )}
        </motion.aside>
      ) : null}
      </div>
    </main>
  );
}
