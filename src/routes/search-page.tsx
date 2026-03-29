import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Search, User, X } from "lucide-react";
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
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { SearchBook, SuggestItem } from "@/types/books";

const SEARCH_HISTORY_KEY = "book-echo-search-history";
const SEARCH_HISTORY_LIMIT = 10;
const AUTHOR_HISTORY_KEY = "book-echo-author-history";
const AUTHOR_HISTORY_LIMIT = 8;

type SearchOption = {
  id: string;
  label: string;
  meta?: string;
  year?: string;
  kind: "book" | "author";
  book?: SearchBook;
  suggest: SuggestItem;
};

interface RecentSearchEntry {
  workId: string;
  query: string;
  book: SearchBook;
}

interface RecentAuthorEntry {
  name: string;
  photoUrl?: string;
  enName?: string;
  url?: string;
}

function readSearchHistory(): RecentSearchEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is RecentSearchEntry => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const candidate = item as Partial<RecentSearchEntry>;
      return (
        typeof candidate.workId === "string" &&
        typeof candidate.query === "string" &&
        Boolean(candidate.book && typeof candidate.book === "object" && typeof candidate.book.title === "string")
      );
    });
  } catch {
    return [];
  }
}

function writeSearchHistory(items: RecentSearchEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items));
}

function pushSearchHistory(items: RecentSearchEntry[], entry: RecentSearchEntry) {
  const trimmedQuery = entry.query.trim();
  if (!trimmedQuery) {
    return items;
  }

  const nextEntry = { ...entry, query: trimmedQuery };
  return [nextEntry, ...items.filter((item) => item.workId !== nextEntry.workId)].slice(0, SEARCH_HISTORY_LIMIT);
}

function readAuthorHistory(): RecentAuthorEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AUTHOR_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentAuthorEntry =>
        item && typeof item === "object" && typeof item.name === "string"
    );
  } catch {
    return [];
  }
}

function writeAuthorHistory(items: RecentAuthorEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTHOR_HISTORY_KEY, JSON.stringify(items));
}

function pushAuthorHistory(items: RecentAuthorEntry[], entry: RecentAuthorEntry) {
  if (!entry.name.trim()) return items;
  return [entry, ...items.filter((item) => item.name !== entry.name)].slice(0, AUTHOR_HISTORY_LIMIT);
}

function getSuggestionOptionId(item: SuggestItem, index: number) {
  return `${item.type}::${item.id}::${index}`;
}

const getOptionLabel = (item: SearchOption) => item.label;

export function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialQueryFromUrl = new URLSearchParams(location.search).get("q")?.trim() ?? "";
  const [query, setQuery] = useState(initialQueryFromUrl);
  const [isOpen, setIsOpen] = useState(Boolean(initialQueryFromUrl));
  const [isComposing, setIsComposing] = useState(false);
  const [searchHistory, setSearchHistory] = useState(readSearchHistory);
  const [authorHistory, setAuthorHistory] = useState(readAuthorHistory);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 260);
  const hasHistory = searchHistory.length > 0 || authorHistory.length > 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const suggestionsQuery = useQuery({
    ...suggestionsQueryOptions(debouncedQuery),
    enabled: !isComposing && Boolean(debouncedQuery.trim())
  });

  const suggestItems = suggestionsQuery.data ?? [];
  const isSuggesting = suggestionsQuery.isFetching;
  const error =
    suggestionsQuery.error instanceof Error
      ? suggestionsQuery.error.message.includes("rate-limited")
        ? "豆瓣当前触发了风控或频率限制，请稍后重试。"
        : "搜索服务暂时不可用，请稍后再试。"
      : "";

  function saveRecentBook(book: SearchBook, workId: string, searchQuery: string) {
    setSearchHistory((current) => {
      const next = pushSearchHistory(current, { workId, query: searchQuery, book });
      if (next !== current) {
        writeSearchHistory(next);
      }
      return next;
    });
  }

  function openBookDetail(book: SearchBook, searchQuery: string) {
    const workId = normalizeWorkId(book.key);
    if (!workId) {
      return false;
    }

    saveRecentBook(book, workId, searchQuery);
    setIsOpen(false);
    setIsComposing(false);
    navigate(`/book/${workId}?q=${encodeURIComponent(searchQuery)}`, {
      state: { book }
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

    const bookItems = suggestItems.filter((item) => item.type === "book");
    const matched = bookItems.find((item) => item.title === trimmed) ?? bookItems[0];
    if (!matched) {
      setIsOpen(true);
      return;
    }

    openBookDetail(suggestItemToSearchBook(matched), matched.title);
  }

  const suggestionOptions = suggestItems.map(
    (item, index): SearchOption => ({
      id: getSuggestionOptionId(item, index),
      label: item.title,
      meta:
        item.type === "author"
          ? item.enName ?? "作者"
          : item.authorName || "作者信息暂缺",
      year: item.year ?? "",
      kind: item.type === "author" ? "author" : "book",
      book: item.type === "book" ? suggestItemToSearchBook(item) : undefined,
      suggest: item
    })
  );
  const comboOpen = isOpen && query.trim().length > 0 && (suggestionOptions.length > 0 || isSuggesting);

  function handleInputValueChange(nextValue: string, details: { reason: string }) {
    if (
      details.reason === "item-press" ||
      details.reason === "list-navigation" ||
      details.reason === "trigger-press" ||
      details.reason === "outside-press" ||
      details.reason === "focus-out" ||
      details.reason === "escape-key"
    ) {
      return;
    }

    setQuery(nextValue);
  }

  function handleOptionSelect(option: SearchOption | null) {
    if (!option) {
      return;
    }

    if (option.kind === "author") {
      const entry: RecentAuthorEntry = {
        name: option.label,
        photoUrl: option.suggest.coverUrl,
        enName: option.suggest.enName,
        url: option.suggest.url
      };
      setAuthorHistory((current) => {
        const next = pushAuthorHistory(current, entry);
        writeAuthorHistory(next);
        return next;
      });
      setIsOpen(false);
      setIsComposing(false);
      navigate(buildAuthorUrl(entry));
      return;
    }

    setQuery(option.label);
    if (option.book && !openBookDetail(option.book, option.label)) {
      submitSearch(option.label);
    }
  }

  return (
    <main className={`bg-[var(--background)] text-[var(--foreground)] ${hasHistory ? "min-h-[100dvh]" : "flex h-[100dvh] flex-col overflow-hidden"}`}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_10%,transparent)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_right,color-mix(in_oklch,var(--primary)_6%,transparent)_0%,transparent_40%)]" />

      <div className={`relative mx-auto w-full max-w-3xl px-5 pb-20 sm:px-8 ${hasHistory ? "pt-16 sm:pt-24" : "flex flex-1 flex-col justify-center pt-0"}`}>
        <header className={`animate-fade-up ${hasHistory ? "mb-10" : "mb-8 text-center"}`}>
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--primary)]/70">Book Echo</p>
          <h1 className="mt-3 font-display text-4xl font-medium leading-tight sm:text-5xl">
            找到你的<span className="text-[var(--primary)]">下一本书</span>
          </h1>
        </header>

        <div ref={searchBarRef} className={`animate-fade-up relative [animation-delay:80ms] ${hasHistory ? "mb-14" : "mb-6"}`}>
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
              aria-label="搜索书籍"
              placeholder="搜索书名、作者……"
              className="h-13 rounded-2xl border-white/60 bg-[var(--surface-elevated)] text-base font-medium shadow-[var(--shadow-warm-sm)] backdrop-blur-xl transition-[box-shadow,border-color] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] has-[[data-slot=input-group-control]:focus-visible]:border-[var(--primary)]/25 has-[[data-slot=input-group-control]:focus-visible]:shadow-[var(--shadow-warm-md)] has-[[data-slot=input-group-control]:focus-visible]:ring-0 [&_input]:pl-11 placeholder:text-[var(--muted-foreground)]/60"
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
                  className="mr-1 inline-flex size-8 items-center justify-center rounded-full text-[var(--muted-foreground)] transition hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
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

            <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-[var(--primary)]/60" />

            <ComboboxContent
              anchor={searchBarRef}
              side="bottom"
              sideOffset={8}
              className="w-(--anchor-width) max-w-none min-w-(--anchor-width) rounded-2xl border border-white/70 bg-[var(--surface-elevated)] py-2 shadow-[var(--shadow-warm-dropdown)] backdrop-blur-xl"
            >
              <ComboboxGroup>
                <ComboboxLabel className="px-5 py-2 text-left text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  搜索建议
                </ComboboxLabel>
                {isSuggesting && suggestItems.length === 0 ? (
                  <div role="status" aria-live="polite" className="flex items-center gap-2.5 px-5 py-3 text-sm text-[var(--muted-foreground)]">
                    <LoaderCircle className="size-4 animate-spin" />
                    正在搜索…
                  </div>
                ) : null}
              </ComboboxGroup>

              <ComboboxEmpty className="px-5 py-3 text-sm">没有找到相关书籍</ComboboxEmpty>

              <ComboboxList>
                {(item: SearchOption) => (
                  <ComboboxItem
                    key={item.id}
                    value={item}
                    className="mx-0 flex items-center justify-between gap-4 rounded-lg px-5 py-2.5 data-highlighted:bg-[var(--accent)]/60"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      {item.kind === "author" ? (
                        <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/60 bg-white/50">
                          {item.suggest.coverUrl ? (
                            <img src={item.suggest.coverUrl} alt={item.label} className="h-full w-full rounded-lg object-cover" loading="lazy" />
                          ) : (
                            <User className="size-5 text-[var(--muted-foreground)]" />
                          )}
                        </div>
                      ) : (
                        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/60 bg-white/50">
                          <BookCover src={getCoverUrl(item.suggest.coverUrl)} title={item.label} className="rounded-lg" loading="lazy" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.label}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">{item.meta}</p>
                      </div>
                    </div>
                    {item.kind === "author" ? (
                      <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">作者</span>
                    ) : item.year ? (
                      <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{item.year}</span>
                    ) : null}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>

          {error ? (
            <div role="alert" className="mt-4 flex items-center gap-3">
              <p className="text-sm text-[var(--destructive)]">{error}</p>
              <button
                type="button"
                className="shrink-0 text-sm font-medium text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-4 transition hover:decoration-[var(--foreground)]"
                onClick={() => suggestionsQuery.refetch()}
              >
                重试
              </button>
            </div>
          ) : null}
        </div>

        {!hasHistory ? null : (
          <div className="animate-fade-up space-y-10 [animation-delay:160ms]">
            {authorHistory.length > 0 ? (
              <section>
                <h2 className="mb-4 text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">最近关注的作者</h2>

                {/* Mobile: horizontal scroll */}
                <div className="flex gap-3 overflow-x-auto pb-2 sm:hidden">
                  {authorHistory.map((author) => (
                    <AuthorAvatarCard key={author.name} author={author} />
                  ))}
                </div>

                {/* Desktop: stacked avatars with hover expand */}
                <TooltipProvider delayDuration={150}>
                  <div className="group/stack hidden items-center sm:flex">
                    <div className="flex items-center">
                      {authorHistory.map((author, index) => (
                        <Tooltip key={author.name}>
                          <TooltipTrigger asChild>
                            <Link
                              to={buildAuthorUrl(author)}
                              className="relative block shrink-0 transition-[margin] duration-300 ease-out group-hover/stack:mr-2"
                              style={{ marginLeft: index === 0 ? 0 : "-0.75rem", zIndex: authorHistory.length - index }}
                            >
                              <div className="size-10 overflow-hidden rounded-full border-2 border-[var(--background)] shadow-sm transition-transform duration-200 hover:scale-110">
                                {author.photoUrl ? (
                                  <img src={author.photoUrl} alt={author.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-white/80 to-[var(--accent)] text-xs font-medium text-[var(--muted-foreground)]">
                                    {author.name.replace(/[\[\]（）()【】\s]/g, "").charAt(0)}
                                  </div>
                                )}
                              </div>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent>{author.name}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                </TooltipProvider>
              </section>
            ) : null}

            {searchHistory.length > 0 ? (
              <section>
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">最近翻阅</h2>
                  <button
                    type="button"
                    className="text-xs text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
                    onClick={() => {
                      setSearchHistory([]);
                      writeSearchHistory([]);
                      setAuthorHistory([]);
                      writeAuthorHistory([]);
                    }}
                  >
                    清空
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {searchHistory.map((item) => (
                    <button
                      key={item.workId}
                      type="button"
                      className="group text-left"
                      onClick={() => openBookDetail(item.book, item.query)}
                    >
                      <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-white/60 bg-white/40 shadow-[var(--shadow-warm-sm)] transition group-hover:shadow-[var(--shadow-warm-md)]">
                        <BookCover
                          src={getCoverUrl(item.book.coverUrl)}
                          title={item.book.title}
                          className="rounded-2xl transition group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      </div>
                      <div className="mt-3 px-0.5">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.book.title}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                          {item.book.authorName?.slice(0, 2).join(" / ") || ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

function buildAuthorUrl(author: RecentAuthorEntry) {
  const params = new URLSearchParams();
  if (author.photoUrl) params.set("photo", author.photoUrl);
  if (author.enName) params.set("en", author.enName);
  if (author.url) params.set("url", author.url);
  const qs = params.toString();
  return `/author/${encodeURIComponent(author.name)}${qs ? `?${qs}` : ""}`;
}

function AuthorAvatarCard({ author }: { author: RecentAuthorEntry }) {
  return (
    <Link
      to={buildAuthorUrl(author)}
      className="flex shrink-0 items-center gap-2.5 rounded-full border border-white/60 bg-white/50 py-1.5 pr-4 pl-1.5 transition hover:bg-white/70"
    >
      <div className="size-8 overflow-hidden rounded-full">
        {author.photoUrl ? (
          <img src={author.photoUrl} alt={author.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-white/80 to-[var(--accent)] text-xs font-medium text-[var(--muted-foreground)]">
            {author.name.replace(/[\[\]（）()【】\s]/g, "").charAt(0)}
          </div>
        )}
      </div>
      <span className="whitespace-nowrap text-sm text-[var(--foreground)]">{author.name}</span>
    </Link>
  );
}
