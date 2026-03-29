import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Search, Sparkles, Trash2, X } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { Button } from "@/components/ui/button";
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
const SEARCH_HISTORY_LIMIT = 8;
const SEARCH_PAGE_ANIMATION_SEEN_KEY = "book-echo-search-page-animation-seen";

type SearchOption =
  | { id: string; label: string; meta?: string; year?: string; kind: "suggestion"; book: SearchBook };

interface RecentSearchEntry {
  workId: string;
  query: string;
  book: SearchBook;
}

function readSearchHistory() {
  if (typeof window === "undefined") {
    return [] as RecentSearchEntry[];
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

  const nextEntry = {
    ...entry,
    query: trimmedQuery
  };

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

function shouldPlaySearchEntranceAnimation() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.sessionStorage.getItem(SEARCH_PAGE_ANIMATION_SEEN_KEY) !== "true";
}

export function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialQueryFromUrl = new URLSearchParams(location.search).get("q")?.trim() ?? "";
  const [shouldAnimateEntrance] = useState(shouldPlaySearchEntranceAnimation);
  const [query, setQuery] = useState(initialQueryFromUrl);
  const [isOpen, setIsOpen] = useState(Boolean(initialQueryFromUrl));
  const [isComposing, setIsComposing] = useState(false);
  const [searchHistory, setSearchHistory] = useState<RecentSearchEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchFrameRef = useRef<HTMLDivElement>(null);
  const searchShellRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 260);

  useEffect(() => {
    inputRef.current?.focus();
    setSearchHistory(readSearchHistory());

    if (shouldAnimateEntrance) {
      window.sessionStorage.setItem(SEARCH_PAGE_ANIMATION_SEEN_KEY, "true");
    }
  }, [shouldAnimateEntrance]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchShellRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
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
      clearSearch(true);
      return;
    }

    const matchedSuggestion = suggestions.find((item) => item.title === trimmed) ?? suggestions[0];
    if (!matchedSuggestion) {
      setIsOpen(true);
      return;
    }

    openBookDetail(matchedSuggestion, matchedSuggestion.title);
  }

  function clearSearch(shouldFocus = false) {
    setQuery("");
    setIsOpen(false);

    if (shouldFocus) {
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }

  const showHistory = searchHistory.length > 0;
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
  const comboItems = suggestionOptions;
  const showSuggestions = isOpen && query.trim().length > 0;
  const showHistoryPanel = isOpen && query.trim().length === 0 && showHistory;
  const comboOpen = showSuggestions && (comboItems.length > 0 || isSuggesting);

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

  const badgeAnimationClass = shouldAnimateEntrance ? "animate-[rise_0.6s_ease_forwards]" : "";
  const searchFrameAnimationClass = shouldAnimateEntrance
    ? "animate-[rise_0.65s_ease_forwards] [animation-delay:120ms]"
    : "";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="relative min-h-screen">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,111,69,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(117,87,63,0.14),transparent_32%)]" />

        <section className="mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-5 pb-16 pt-8 sm:px-8 lg:px-10">
          <div className="mx-auto flex w-full flex-1 flex-col items-center justify-center text-center">
              <div className={badgeAnimationClass}>
                <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-4 py-2 text-xs uppercase tracking-[0.35em] text-[var(--muted-foreground)] backdrop-blur-sm">
                  <Sparkles className="size-3.5" />
                  Book Echo
                </p>
              </div>

              <div className={`relative z-30 mt-6 w-full max-w-3xl ${searchFrameAnimationClass}`.trim()}>
                <div
                  ref={searchFrameRef}
                  className="rounded-[36px] border border-white/70 bg-white/50 p-3 shadow-[0_24px_70px_rgba(95,66,43,0.12)] backdrop-blur-xl"
                >
                  <form
                    className="flex flex-col gap-3 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (comboOpen) {
                        return;
                      }
                      submitSearch(query);
                    }}
                  >
                    <div ref={searchShellRef} className="relative flex-1">
                      <Combobox<SearchOption>
                        items={comboItems}
                        itemToStringLabel={(item) => item.label}
                        itemToStringValue={(item) => item.label}
                        inputValue={query}
                        open={comboOpen}
                        onOpenChange={setIsOpen}
                        onInputValueChange={handleInputValueChange}
                        onValueChange={(value) => handleOptionSelect(value)}
                        autoHighlight
                      >
                        <ComboboxInput
                          ref={inputRef}
                          showTrigger={false}
                          showClear={false}
                          placeholder="试试：三体、雪国、博尔赫斯、村上春树……"
                          className="h-16 rounded-full border-transparent bg-[#fffaf3] px-5 text-base shadow-none focus-visible:ring-0"
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
                          <button
                            type="button"
                            className={`mr-1 inline-flex size-9 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-all duration-200 hover:bg-white hover:text-[var(--foreground)] ${query ? "scale-100 opacity-100" : "pointer-events-none scale-75 opacity-0"}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              clearSearch(true);
                              setIsOpen(true);
                            }}
                            aria-label="清除搜索词"
                            tabIndex={query ? 0 : -1}
                          >
                            <X className="size-4" />
                          </button>
                        </ComboboxInput>

                        <ComboboxContent
                          anchor={searchFrameRef}
                          side="top"
                          className="w-(--anchor-width) max-w-none min-w-(--anchor-width) rounded-[28px] border border-white/70 bg-white/92 p-2 shadow-[0_28px_80px_rgba(96,65,42,0.14)] backdrop-blur-xl"
                        >
                          {showSuggestions ? (
                            <ComboboxGroup>
                              <ComboboxLabel className="px-3 py-2 text-left text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
                                自动建议
                              </ComboboxLabel>
                              {isSuggesting ? (
                                <div className="flex items-center gap-2 rounded-[22px] px-3 py-4 text-sm text-[var(--muted-foreground)]">
                                  <LoaderCircle className="size-4 animate-spin" />
                                  正在获取建议...
                                </div>
                              ) : null}
                            </ComboboxGroup>
                          ) : null}

                          <ComboboxEmpty>没有可用建议，回车直接搜索。</ComboboxEmpty>
                          <ComboboxList className="space-y-1">
                            {(item: SearchOption) => (
                              <ComboboxItem
                                key={item.id}
                                value={item}
                                className="items-center justify-between gap-4 rounded-[22px] px-3 py-3 data-highlighted:bg-[var(--accent)]"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded-[16px] border border-white/70 bg-white/70">
                                    <BookCover src={getCoverUrl(item.book.coverUrl)} title={item.label} className="rounded-[16px]" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-[var(--foreground)]">{item.label}</p>
                                    <p className="mt-1 truncate text-sm text-[var(--muted-foreground)]">{item.meta}</p>
                                  </div>
                                </div>
                                {"year" in item && item.year ? (
                                  <span className="text-xs text-[var(--muted-foreground)]">{item.year}</span>
                                ) : null}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>

                      {showHistoryPanel ? (
                        <div className="absolute right-0 bottom-full z-40 mb-3 w-full rounded-[28px] border border-white/70 bg-white/92 p-4 shadow-[0_28px_80px_rgba(96,65,42,0.14)] backdrop-blur-xl">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-left text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
                              最近搜索
                            </div>
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-[11px] tracking-[0.18em] normal-case text-[var(--muted-foreground)] transition hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setSearchHistory([]);
                                writeSearchHistory([]);
                                inputRef.current?.focus();
                              }}
                            >
                              <Trash2 className="size-3.5" />
                              清空
                            </button>
                          </div>

                          <div className="mt-4 flex flex-col gap-2">
                            {searchHistory.map((item) => (
                              <button
                                key={item.workId}
                                type="button"
                                className="flex items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition hover:bg-[var(--accent)]"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setQuery(item.query);
                                  setIsOpen(false);
                                  void queryClient.prefetchQuery(bookDetailQueryOptions(item.workId));
                                  navigate(`/book/${item.workId}?q=${encodeURIComponent(item.query)}`, {
                                    state: { book: item.book }
                                  });
                                }}
                              >
                                <div className="h-12 w-9 shrink-0 overflow-hidden rounded-[10px] border border-white/70 bg-white/70">
                                  <BookCover src={getCoverUrl(item.book.coverUrl)} title={item.book.title} className="rounded-[10px]" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.book.title}</p>
                                  <p className="truncate text-xs text-[var(--muted-foreground)]">
                                    {item.book.authorName?.slice(0, 2).join(" / ") || ""}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <Button type="submit" size="lg" className="h-16 rounded-[28px] px-8">
                      {isSuggesting ? <LoaderCircle className="size-5 animate-spin" /> : <Search className="size-5" />}
                      打开书籍
                    </Button>
                  </form>
                </div>
              </div>
              {error ? <p className="mt-6 text-center text-sm text-[var(--primary)]">{error}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
