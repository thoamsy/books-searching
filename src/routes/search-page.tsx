import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, LoaderCircle, Search, Sparkles, Trash2 } from "lucide-react";
import { ResultItem } from "@/components/result-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { getSuggestions, searchBooks } from "@/lib/books-api";
import type { SearchBook } from "@/types/books";

const SEARCH_HISTORY_KEY = "book-echo-search-history";
const SEARCH_HISTORY_LIMIT = 8;

function readSearchHistory() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeSearchHistory(items: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items));
}

function pushSearchHistory(items: string[], term: string) {
  const trimmed = term.trim();
  if (!trimmed) {
    return items;
  }

  return [trimmed, ...items.filter((item) => item !== trimmed)].slice(0, SEARCH_HISTORY_LIMIT);
}

export function SearchPage() {
  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [results, setResults] = useState<SearchBook[]>([]);
  const [suggestions, setSuggestions] = useState<SearchBook[]>([]);
  const [isSearching, setIsSearching] = useState(Boolean(initialQuery));
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 260);
  const hasSearched = Boolean(searchTerm);

  useEffect(() => {
    inputRef.current?.focus();
    setSearchHistory(readSearchHistory());
  }, []);

  useEffect(() => {
    if (isComposing || !debouncedQuery.trim()) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    setIsSuggesting(true);

    getSuggestions(debouncedQuery)
      .then((items) => {
        if (!cancelled) {
          setSuggestions(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSuggesting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, isComposing]);

  useEffect(() => {
    if (!initialQuery.trim()) {
      return;
    }

    void runSearch(initialQuery);
  }, []);

  async function runSearch(term: string) {
    const trimmed = term.trim();

    if (isComposing) {
      return;
    }

    if (!trimmed) {
      setResults([]);
      setTotal(0);
      setSearchTerm("");
      window.history.replaceState({}, "", "/");
      return;
    }

    setIsSearching(true);
    setError("");
    setSearchTerm(trimmed);
    setIsFocused(false);
    setSuggestions([]);

    try {
      const data = await searchBooks(trimmed);
      setResults(data.docs);
      setTotal(data.numFound);
      window.history.replaceState({}, "", `/?q=${encodeURIComponent(trimmed)}`);
      setSearchHistory((current) => {
        const next = pushSearchHistory(current, trimmed);
        writeSearchHistory(next);
        return next;
      });
    } catch (searchError) {
      const message =
        searchError instanceof Error && searchError.message.includes("rate-limited")
          ? "豆瓣当前触发了风控或频率限制，请稍后重试。"
          : "搜索服务暂时不可用，请稍后再试。";
      setError(message);
      setResults([]);
      setTotal(0);
    } finally {
      setIsSearching(false);
    }
  }

  const suggestionPanelVisible = useMemo(
    () => !hasSearched && isFocused && query.trim().length > 0 && (suggestions.length > 0 || isSuggesting),
    [hasSearched, isFocused, query, suggestions.length, isSuggesting]
  );
  const showHistory = results.length === 0 && searchHistory.length > 0;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="relative min-h-screen">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,111,69,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(117,87,63,0.14),transparent_32%)]" />

        <section className="mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-5 pb-16 pt-8 sm:px-8 lg:px-10">
          <div className="mx-auto flex w-full flex-1 flex-col">
            <div
              className={`flex flex-col items-center text-center transition-all duration-300 ${
                hasSearched ? "justify-start pt-4" : "flex-1 justify-center"
              }`}
            >
              <div className="animate-[rise_0.6s_ease_forwards]">
                <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-4 py-2 text-xs uppercase tracking-[0.35em] text-[var(--muted-foreground)] backdrop-blur-sm">
                  <Sparkles className="size-3.5" />
                  Book Echo
                </p>
                <h1
                  className={`mx-auto max-w-4xl font-display leading-[0.92] transition-all duration-300 ${
                    hasSearched ? "text-4xl sm:text-5xl md:text-6xl" : "text-6xl sm:text-7xl md:text-8xl"
                  }`}
                >
                  搜书、作者、版本，
                  <span className="block text-[var(--primary)]">像翻检一座安静的目录馆。</span>
                </h1>
                {!hasSearched ? (
                  <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)] sm:text-base">
                    输入书名、作者或主题词，实时获得建议；点击结果即可进入详情页查看简介、作者和主题信息。
                  </p>
                ) : null}
              </div>

              <div className="relative mt-10 w-full max-w-3xl animate-[rise_0.65s_ease_forwards] [animation-delay:120ms]">
                <div className="rounded-[36px] border border-white/70 bg-white/50 p-3 shadow-[0_24px_70px_rgba(95,66,43,0.12)] backdrop-blur-xl">
                  <form
                    className="flex flex-col gap-3 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runSearch(query);
                    }}
                  >
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-[var(--muted-foreground)]" />
                      <Input
                        ref={inputRef}
                        value={query}
                        onCompositionStart={() => setIsComposing(true)}
                        onCompositionEnd={(event) => {
                          setIsComposing(false);
                          setQuery(event.currentTarget.value);
                        }}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => window.setTimeout(() => setIsFocused(false), 140)}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="试试：三体、雪国、博尔赫斯、村上春树……"
                        className="h-16 border-transparent pl-13 pr-5 text-base"
                      />
                    </div>
                    <Button type="submit" size="lg" className="h-16 rounded-[28px] px-8">
                      {isSearching ? <LoaderCircle className="size-5 animate-spin" /> : <Search className="size-5" />}
                      搜索书籍
                    </Button>
                  </form>
                </div>

                {suggestionPanelVisible ? (
                  <div className="absolute inset-x-0 top-[calc(100%+14px)] z-20 rounded-[28px] border border-white/70 bg-white/92 p-3 shadow-[0_28px_80px_rgba(96,65,42,0.14)] backdrop-blur-xl">
                    <div className="mb-2 px-3 text-left text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
                      自动建议
                    </div>
                    <div className="space-y-1">
                      {isSuggesting ? (
                        <div className="flex items-center gap-2 rounded-[22px] px-3 py-4 text-sm text-[var(--muted-foreground)]">
                          <LoaderCircle className="size-4 animate-spin" />
                          正在获取建议...
                        </div>
                      ) : (
                        suggestions.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            className="flex w-full items-center justify-between rounded-[22px] px-3 py-4 text-left transition hover:bg-[var(--accent)]"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setQuery(item.title);
                              setIsComposing(false);
                              setIsFocused(false);
                              setSuggestions([]);
                              void runSearch(item.title);
                            }}
                          >
                            <div>
                              <p className="font-medium text-[var(--foreground)]">{item.title}</p>
                              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                                {item.authorName.slice(0, 2).join(" / ") || "作者信息暂缺"}
                              </p>
                            </div>
                            <span className="text-xs text-[var(--muted-foreground)]">{item.firstPublishYear ?? ""}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {showHistory ? (
                <div className="mt-6 w-full max-w-3xl animate-[rise_0.72s_ease_forwards] text-left">
                  <div className="rounded-[28px] border border-white/70 bg-white/58 p-4 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                        <Clock3 className="size-4" />
                        最近搜索
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-white/70 hover:text-[var(--foreground)]"
                        onClick={() => {
                          setSearchHistory([]);
                          writeSearchHistory([]);
                        }}
                      >
                        <Trash2 className="size-4" />
                        清空
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {searchHistory.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="rounded-full border border-[var(--border)] bg-white/75 px-4 py-2 text-sm text-[var(--foreground)] transition hover:border-[var(--primary)]/35 hover:bg-white"
                          onClick={() => {
                            setQuery(item);
                            void runSearch(item);
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={`animate-[rise_0.7s_ease_forwards] [animation-delay:180ms] ${hasSearched ? "mt-8" : "mt-10"}`}>
              {error ? <p className="mb-4 text-center text-sm text-[var(--primary)]">{error}</p> : null}

              {searchTerm ? (
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Search Result</p>
                    <h2 className="mt-2 max-w-4xl font-display text-3xl leading-tight sm:text-4xl md:text-5xl">
                      “{searchTerm}” 找到 {total.toLocaleString()} 条相关结果
                    </h2>
                  </div>
                </div>
              ) : null}

              {results.length > 0 ? (
                <div className="grid gap-4">
                  {results.map((book) => (
                    <ResultItem key={book.key} book={book} query={searchTerm} />
                  ))}
                </div>
              ) : searchTerm && !isSearching && !error ? (
                <div className="rounded-[32px] border border-dashed border-[var(--border)] px-8 py-14 text-center text-[var(--muted-foreground)]">
                  没有找到匹配结果，换个关键词试试。
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
