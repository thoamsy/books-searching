import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Film, LoaderCircle, Search, Tv, User, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { batchUpsertSearchHistory, upsertSearchHistory, clearSearchHistory } from "@/lib/supabase-api";
import { searchHistoryQueryOptions } from "@/lib/supabase-queries";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BookCover } from "@/components/book-cover";
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
import {
  bookHistoryStore,
  movieHistoryStore,
  personHistoryStore,
  writeRowsToLocal,
} from "@/lib/history-utils";
import type { RecentPersonEntry } from "@/lib/history-utils";
import { cn } from "@/lib/utils";
import { DepthLink } from "@/components/depth-link";
import { TiltCard } from "@/components/tilt-card";
import { useLocation, useNavigate } from "react-router-dom";
import type { SearchBook, SuggestItem } from "@/types/books";
import type { SearchMovie } from "@/types/movies";
import type { MovieSuggestItem } from "@/types/movies";
import type { SearchHistoryRow } from "@/types/supabase";

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

export function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialQueryFromUrl = new URLSearchParams(location.search).get("q")?.trim() ?? "";
  const [query, setQuery] = useState(initialQueryFromUrl);
  const [isOpen, setIsOpen] = useState(Boolean(initialQueryFromUrl));
  const [isComposing, setIsComposing] = useState(false);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  // ---------------------------------------------------------------------------
  // Unified history query — cloud when logged in, localStorage otherwise.
  // placeholderData shows localStorage instantly while cloud fetches.
  // ---------------------------------------------------------------------------
  const historyQuery = useQuery(searchHistoryQueryOptions(userId));
  const rows = historyQuery.data ?? [];

  const displayBooks = rows
    .filter((r) => r.type === "book" && r.extra?.workId && r.extra?.book)
    .map((r) => ({
      workId: r.extra.workId as string,
      query: r.keyword,
      book: r.extra.book as SearchBook,
    }));

  const displayMovies = rows
    .filter((r) => r.type === "movie" && r.extra?.subjectId && r.extra?.movie)
    .map((r) => ({
      subjectId: r.extra.subjectId as string,
      query: r.keyword,
      movie: r.extra.movie as SearchMovie,
    }));

  const displayPersons: RecentPersonEntry[] = rows
    .filter((r) => r.type === "author" || r.type === "celebrity")
    .map((r) => ({
      kind: r.type as "author" | "celebrity",
      name: r.keyword,
      photoUrl: r.extra?.photoUrl as string | undefined,
      enName: r.extra?.enName as string | undefined,
      url: r.extra?.url as string | undefined,
      celebrityId: r.extra?.celebrityId as string | undefined,
    }));

  const inputRef = useRef<HTMLInputElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 260);
  const hasBookHistory = displayBooks.length > 0;
  const hasMovieHistory = displayMovies.length > 0;
  const hasHistory = hasBookHistory || hasMovieHistory || displayPersons.length > 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync cloud data back to localStorage so next load's placeholderData is fresh
  useEffect(() => {
    if (userId && historyQuery.data && !historyQuery.isPlaceholderData) {
      writeRowsToLocal(historyQuery.data);
    }
  }, [userId, historyQuery.data, historyQuery.isPlaceholderData]);

  // Migrate localStorage to cloud on first login
  useEffect(() => {
    if (!userId) return;
    const migrationKey = `opus-history-migrated-${userId}`;
    if (localStorage.getItem(migrationKey)) return;

    const localBooks = bookHistoryStore.read();
    const localMovies = movieHistoryStore.read();
    const localPersons = personHistoryStore.read();

    const entries = [
      ...localBooks.map((b) => ({
        keyword: b.query,
        type: "book" as const,
        extra: { workId: b.workId, book: b.book },
      })),
      ...localMovies.map((m) => ({
        keyword: m.query,
        type: "movie" as const,
        extra: { subjectId: m.subjectId, movie: m.movie },
      })),
      ...localPersons.map((p) => ({
        keyword: p.name,
        type: p.kind as "author" | "celebrity",
        extra: { photoUrl: p.photoUrl, enName: p.enName, url: p.url, celebrityId: p.celebrityId },
      })),
    ];

    if (entries.length > 0) {
      batchUpsertSearchHistory(userId, entries)
        .then(() => {
          localStorage.setItem(migrationKey, "1");
          queryClient.invalidateQueries({ queryKey: ["search-history", userId] });
        })
        .catch((err) => console.error("[migration] failed to sync history:", err));
    } else {
      localStorage.setItem(migrationKey, "1");
    }
  }, [userId, queryClient]);

  // ---------------------------------------------------------------------------
  // Tri-layer write helper: query cache → localStorage → cloud
  // ---------------------------------------------------------------------------
  const historyKey = searchHistoryQueryOptions(userId).queryKey;

  function saveToHistory(
    type: SearchHistoryRow["type"],
    keyword: string,
    extra: Record<string, unknown>,
    dedupMatch: (r: SearchHistoryRow) => boolean,
  ) {
    const newRow: SearchHistoryRow = {
      id: 0,
      user_id: userId ?? "local",
      keyword,
      type,
      extra,
      searched_at: new Date().toISOString(),
    };
    const prev = queryClient.getQueryData<SearchHistoryRow[]>(historyKey) ?? [];
    const updated = [newRow, ...prev.filter((r) => !dedupMatch(r))];
    queryClient.setQueryData<SearchHistoryRow[]>(historyKey, updated);
    writeRowsToLocal(updated);
    if (userId) {
      upsertSearchHistory(userId, keyword, type, extra)
        .then(() => queryClient.invalidateQueries({ queryKey: historyKey }))
        .catch(() => {});
    }
  }

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
  // Save & navigate helpers
  // ---------------------------------------------------------------------------
  function openBookDetail(book: SearchBook, searchQuery: string) {
    const workId = normalizeWorkId(book.key);
    if (!workId) return false;

    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      saveToHistory("book", trimmedQuery, { workId, book },
        (r) => r.type === "book" && r.extra?.workId === workId);
    }
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

    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      saveToHistory("movie", trimmedQuery, { subjectId, movie },
        (r) => r.type === "movie" && r.extra?.subjectId === subjectId);
    }
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
      const extra = {
        photoUrl: option.suggest.coverUrl,
        enName: option.suggest.enName,
        url: option.suggest.url,
      };
      saveToHistory("author", option.label, extra,
        (r) => r.type === "author" && r.keyword === option.label);

      setIsOpen(false);
      setIsComposing(false);
      const entry: RecentPersonEntry = {
        kind: "author",
        name: option.label,
        photoUrl: option.suggest.coverUrl,
        enName: option.suggest.enName,
        url: option.suggest.url,
      };
      navigate(buildPersonUrl(entry), { state: { navDepth: 1 } });
      return;
    }

    if (option.kind === "celebrity" && option.movieSuggest) {
      const extra = {
        photoUrl: option.movieSuggest.coverUrl,
        celebrityId: option.movieSuggest.id,
      };
      saveToHistory("celebrity", option.label, extra,
        (r) => r.type === "celebrity" && r.keyword === option.label);

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

  function handleClear() {
    // Clear query cache
    queryClient.setQueryData<SearchHistoryRow[]>(historyKey, []);
    // Clear localStorage
    bookHistoryStore.write([]);
    movieHistoryStore.write([]);
    personHistoryStore.write([]);
    // Clear cloud
    if (userId) {
      clearSearchHistory(userId).catch(() => {});
    }
  }

  return (
    <main className={cn(
      "min-h-[100dvh] bg-background text-foreground",
      !hasBookHistory && "flex flex-col"
    )}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_10%,transparent)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_right,color-mix(in_oklch,var(--primary)_6%,transparent)_0%,transparent_40%)]" />

      <div className={cn(
        "relative mx-auto w-full max-w-3xl px-5 pb-20 sm:px-8",
        hasBookHistory ? "pt-16 sm:pt-24" : "my-auto"
      )}>
        <header className={cn("animate-fade-up", hasBookHistory ? "mb-10" : "mb-8 text-center")}>
          <p className={cn("flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-primary/70", !hasBookHistory && "justify-center")}>
            <img src="/favicon.svg" alt="" className="size-5" />
            <span className="font-display">Opus</span>
          </p>
          <h1 className="mt-3 font-display text-4xl font-medium leading-tight sm:text-5xl">
            找到你的<span className="text-primary">下一部作品</span>
          </h1>
        </header>

        <div ref={searchBarRef} className={cn("animate-fade-up relative [animation-delay:80ms]", hasBookHistory ? "mb-14" : "mb-6")}>
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
              placeholder="搜索书名、电影、电视剧……"
              className="h-13 rounded-2xl border-white/60 bg-surface-elevated text-base font-medium shadow-warm-sm backdrop-blur-xl transition-[box-shadow,border-color] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] has-[[data-slot=input-group-control]:focus-visible]:border-primary/25 has-[[data-slot=input-group-control]:focus-visible]:shadow-warm-md has-[[data-slot=input-group-control]:focus-visible]:ring-0 [&_input]:pl-11 placeholder:text-muted-foreground/60"
              onFocus={() => setIsOpen(true)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={(event) => {
                setIsComposing(false);
                setQuery(event.currentTarget.value);
              }}
              onKeyDown={(event) => {
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
              className="w-(--anchor-width) max-w-none min-w-(--anchor-width) rounded-2xl border border-white/70 bg-surface-elevated py-2 shadow-warm-dropdown backdrop-blur-xl"
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
                        <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/60 bg-white/50">
                          {(item.suggest?.coverUrl ?? item.movieSuggest?.coverUrl) ? (
                            <img src={(item.suggest?.coverUrl ?? item.movieSuggest?.coverUrl)!} alt={item.label} className="h-full w-full rounded-lg object-cover" loading="lazy" />
                          ) : (
                            <User className="size-5 text-muted-foreground" />
                          )}
                        </div>
                      ) : (item.kind === "movie" || item.kind === "tv") ? (
                        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/60 bg-white/50">
                          {item.movieSuggest?.coverUrl ? (
                            <img src={item.movieSuggest.coverUrl} alt={item.label} className="h-full w-full rounded-lg object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              {item.kind === "tv" ? <Tv className="size-5 text-muted-foreground" /> : <Film className="size-5 text-muted-foreground" />}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/60 bg-white/50">
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
        </div>

        {!hasHistory ? null : (
          <div className="@container animate-fade-up flex flex-col gap-10 [animation-delay:160ms]">
            {displayPersons.length > 0 ? (
              <section>
                <h2 className="mb-4 text-xs uppercase tracking-[0.28em] text-muted-foreground">最近关注</h2>

                {/* Mobile: horizontal scroll */}
                <div className="flex gap-3 overflow-x-auto pb-2 sm:hidden">
                  {displayPersons.map((person) => (
                    <PersonAvatarCard key={`${person.kind}:${person.name}`} person={person} />
                  ))}
                </div>

                {/* Desktop: stacked avatars with hover expand */}
                <TooltipProvider delayDuration={150}>
                  <div className="group/stack hidden items-center sm:flex">
                    <div className="flex items-center">
                      {displayPersons.map((person, index) => (
                        <Tooltip key={`${person.kind}:${person.name}`}>
                          <TooltipTrigger asChild>
                            <DepthLink
                              to={buildPersonUrl(person)}
                              className="relative block shrink-0 transition-[margin] duration-300 ease-out hover:!z-50 group-hover/stack:mr-2"
                              style={{ marginLeft: index === 0 ? 0 : "-0.75rem", zIndex: displayPersons.length - index }}
                            >
                              <div className="size-10 overflow-hidden rounded-full border-2 border-background shadow-sm transition-transform duration-200 hover:scale-110">
                                {person.photoUrl ? (
                                  <img src={person.photoUrl} alt={person.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-white/80 to-accent text-xs font-medium text-muted-foreground">
                                    {person.name.replace(/[\[\]（）()【】\s]/g, "").charAt(0)}
                                  </div>
                                )}
                              </div>
                            </DepthLink>
                          </TooltipTrigger>
                          <TooltipContent>{person.name}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                </TooltipProvider>
              </section>
            ) : null}

            {displayMovies.length > 0 ? (
              <section>
                <h2 className="mb-5 text-xs uppercase tracking-[0.28em] text-muted-foreground">最近观影</h2>
                <RecentMediaGrid
                  items={displayMovies.map((item) => ({
                    key: item.subjectId,
                    to: `/movie/${item.subjectId}?q=${encodeURIComponent(item.query)}`,
                    state: { movie: item.movie },
                    title: item.movie.title,
                    subtitle: item.movie.director?.slice(0, 2).join(" / ") || item.movie.year || "",
                    coverUrl: item.movie.coverUrl,
                    aspect: "2/3" as const,
                  }))}
                />
              </section>
            ) : null}

            {displayBooks.length > 0 ? (
              <section>
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-xs uppercase tracking-[0.28em] text-muted-foreground">最近翻阅</h2>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground transition hover:text-foreground"
                    onClick={handleClear}
                  >
                    清空
                  </button>
                </div>

                <RecentMediaGrid
                  items={displayBooks.map((item) => ({
                    key: item.workId,
                    to: `/book/${item.workId}?q=${encodeURIComponent(item.query)}`,
                    state: { book: item.book },
                    title: item.book.title,
                    subtitle: item.book.authorName?.slice(0, 2).join(" / ") || "",
                    coverUrl: getCoverUrl(item.book.coverUrl),
                    aspect: "3/4" as const,
                  }))}
                />
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

function buildPersonUrl(person: RecentPersonEntry) {
  if (person.kind === "celebrity" && person.celebrityId) {
    return `/celebrity/${person.celebrityId}`;
  }
  const params = new URLSearchParams();
  if (person.photoUrl) params.set("photo", person.photoUrl);
  if (person.enName) params.set("en", person.enName);
  if (person.url) params.set("url", person.url);
  const qs = params.toString();
  return `/author/${encodeURIComponent(person.name)}${qs ? `?${qs}` : ""}`;
}

interface RecentMediaItem {
  key: string;
  to: string;
  state?: Record<string, unknown>;
  title: string;
  subtitle: string;
  coverUrl?: string | null;
  aspect: "2/3" | "3/4";
}

function RecentMediaCard({ item }: { item: RecentMediaItem }) {
  const variant = item.aspect === "3/4" ? "book" : "poster";
  return (
    <DepthLink
      to={item.to}
      state={item.state}
      className="group"
    >
      <TiltCard
        variant={variant}
        className="overflow-hidden rounded-lg border border-white/60 bg-white/40 shadow-warm-sm transition-shadow group-hover:shadow-warm-md"
        style={{ aspectRatio: item.aspect }}
      >
        {item.coverUrl ? (
          variant === "book" ? (
            <BookCover
              src={item.coverUrl}
              title={item.title}
              className="rounded-lg"
              loading="lazy"
            />
          ) : (
            <img
              src={item.coverUrl}
              alt={item.title}
              className="h-full w-full rounded-lg object-cover"
              loading="lazy"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(231,211,185,0.94))]">
            <Film className="size-10 text-muted-foreground" />
          </div>
        )}
      </TiltCard>
      <div className="mt-2 px-0.5">
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</p>
      </div>
    </DepthLink>
  );
}

function RecentMediaGrid({ items }: { items: RecentMediaItem[] }) {
  return (
    <>
      {/* Mobile: horizontal scroll with snap */}
      <div className="-mr-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pr-5 sm:hidden">
        {items.map((item) => (
          <div key={item.key} className="w-[calc((100%-0.75rem*2)/3.4)] shrink-0 snap-start">
            <RecentMediaCard item={item} />
          </div>
        ))}
      </div>

      {/* Desktop: grid */}
      <div className="hidden grid-cols-3 gap-3 @2xl:grid-cols-4 sm:grid">
        {items.map((item) => (
          <RecentMediaCard key={item.key} item={item} />
        ))}
      </div>
    </>
  );
}

function PersonAvatarCard({ person }: { person: RecentPersonEntry }) {
  return (
    <DepthLink
      to={buildPersonUrl(person)}
      className="flex shrink-0 items-center gap-2.5 rounded-full border border-white/60 bg-white/50 py-1.5 pr-4 pl-1.5 transition hover:bg-white/70"
    >
      <div className="size-8 overflow-hidden rounded-full">
        {person.photoUrl ? (
          <img src={person.photoUrl} alt={person.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-white/80 to-accent text-xs font-medium text-muted-foreground">
            {person.name.replace(/[\[\]（）()【】\s]/g, "").charAt(0)}
          </div>
        )}
      </div>
      <span className="whitespace-nowrap text-sm text-foreground">{person.name}</span>
    </DepthLink>
  );
}
