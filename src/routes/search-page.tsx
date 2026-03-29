import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Search, X } from "lucide-react";
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
import { getCoverUrl, normalizeWorkId } from "@/lib/books-api";
import { bookDetailQueryOptions, suggestionsQueryOptions } from "@/lib/book-queries";
import { queryClient } from "@/lib/query-client";
import { useLocation, useNavigate } from "react-router-dom";
import type { SearchBook } from "@/types/books";

const SEARCH_HISTORY_KEY = "book-echo-search-history";
const SEARCH_HISTORY_LIMIT = 10;

type SearchOption = {
  id: string;
  label: string;
  meta?: string;
  year?: string;
  kind: "suggestion";
  book: SearchBook;
};

interface RecentSearchEntry {
  workId: string;
  query: string;
  book: SearchBook;
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

function getSuggestionOptionId(book: SearchBook, index: number) {
  return [
    book.key || "unknown",
    book.externalUrl || "no-url",
    book.coverUrl || "no-cover",
    book.firstPublishYear ? String(book.firstPublishYear) : "no-year",
    String(index)
  ].join("::");
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
  const inputRef = useRef<HTMLInputElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 260);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const suggestionsQuery = useQuery({
    ...suggestionsQueryOptions(debouncedQuery),
    enabled: !isComposing && Boolean(debouncedQuery.trim())
  });

  const suggestions = suggestionsQuery.data ?? [];
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
    void queryClient.prefetchQuery(bookDetailQueryOptions(workId));
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

    const matchedSuggestion = suggestions.find((item) => item.title === trimmed) ?? suggestions[0];
    if (!matchedSuggestion) {
      setIsOpen(true);
      return;
    }

    openBookDetail(matchedSuggestion, matchedSuggestion.title);
  }

  const suggestionOptions = suggestions.map(
    (item, index): SearchOption => ({
      id: getSuggestionOptionId(item, index),
      label: item.title,
      meta: item.authorName.slice(0, 2).join(" / ") || "作者信息暂缺",
      year: item.firstPublishYear ? String(item.firstPublishYear) : "",
      kind: "suggestion",
      book: item
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

    setQuery(option.label);
    if (!openBookDetail(option.book, option.label)) {
      submitSearch(option.label);
    }
  }

  return (
    <main className={`bg-[var(--background)] text-[var(--foreground)] ${searchHistory.length > 0 ? "min-h-[100dvh]" : "h-[100dvh] overflow-hidden"}`}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_30%)]" />

      <div className="relative mx-auto max-w-3xl px-5 pt-16 pb-20 sm:px-8 sm:pt-24">
        <header className="animate-fade-up mb-10">
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted-foreground)]">Book Echo</p>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            找到你的<br />下一本书
          </h1>
        </header>

        <div ref={searchBarRef} className="animate-fade-up relative mb-14 [animation-delay:80ms]">
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

            <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-[var(--muted-foreground)]" />

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
                {isSuggesting && suggestions.length === 0 ? (
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
                    className="mx-0 flex items-center justify-between gap-4 rounded-none px-5 py-2.5 data-highlighted:bg-[var(--accent)]/60"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/60 bg-white/50">
                        <BookCover src={getCoverUrl(item.book.coverUrl)} title={item.label} className="rounded-lg" loading="lazy" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.label}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">{item.meta}</p>
                      </div>
                    </div>
                    {item.year ? (
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

        {searchHistory.length > 0 ? (
          <section className="animate-fade-up [animation-delay:160ms]">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">最近翻阅</h2>
              <button
                type="button"
                className="text-xs text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
                onClick={() => {
                  setSearchHistory([]);
                  writeSearchHistory([]);
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
        ) : (
          <div className="animate-fade-up py-12 text-center [animation-delay:160ms]">
            <p className="text-sm text-[var(--muted-foreground)]">搜索一本书，它会出现在这里</p>
          </div>
        )}
      </div>
    </main>
  );
}
