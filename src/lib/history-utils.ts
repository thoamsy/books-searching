import type { SearchBook } from "@/types/books";
import type { SearchMovie } from "@/types/movies";
import type { SearchHistoryRow } from "@/types/supabase";

// ---------------------------------------------------------------------------
// Generic localStorage history store
// ---------------------------------------------------------------------------

export function createHistoryStore<T>(options: {
  key: string;
  limit: number;
  validate: (item: unknown) => item is T;
  dedupKey: (item: T) => string;
}) {
  function read(): T[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(options.key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(options.validate);
    } catch {
      return [];
    }
  }

  function write(items: T[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(options.key, JSON.stringify(items));
  }

  function push(items: T[], entry: T): T[] {
    return [entry, ...items.filter((item) => options.dedupKey(item) !== options.dedupKey(entry))].slice(0, options.limit);
  }

  return { read, write, push };
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface RecentSearchEntry {
  workId: string;
  query: string;
  book: SearchBook;
}

export interface RecentMovieEntry {
  subjectId: string;
  query: string;
  movie: SearchMovie;
}

export interface RecentPersonEntry {
  kind: "author" | "celebrity";
  name: string;
  photoUrl?: string;
  enName?: string;
  url?: string;
  celebrityId?: string;
}

// ---------------------------------------------------------------------------
// Store instances
// ---------------------------------------------------------------------------

export const bookHistoryStore = createHistoryStore<RecentSearchEntry>({
  key: "opus-search-history",
  limit: 10,
  validate: (item): item is RecentSearchEntry =>
    item != null && typeof item === "object" &&
    typeof (item as RecentSearchEntry).workId === "string" &&
    typeof (item as RecentSearchEntry).query === "string" &&
    Boolean((item as RecentSearchEntry).book?.title),
  dedupKey: (item) => item.workId
});

export const personHistoryStore = createHistoryStore<RecentPersonEntry>({
  key: "opus-person-history",
  limit: 12,
  validate: (item): item is RecentPersonEntry =>
    item != null && typeof item === "object" &&
    typeof (item as RecentPersonEntry).name === "string" &&
    ((item as RecentPersonEntry).kind === "author" || (item as RecentPersonEntry).kind === "celebrity"),
  dedupKey: (item) => `${item.kind}:${item.name}`
});

export const movieHistoryStore = createHistoryStore<RecentMovieEntry>({
  key: "opus-movie-history",
  limit: 10,
  validate: (item): item is RecentMovieEntry =>
    item != null && typeof item === "object" &&
    typeof (item as RecentMovieEntry).subjectId === "string" &&
    Boolean((item as RecentMovieEntry).movie),
  dedupKey: (item) => item.subjectId
});

// ---------------------------------------------------------------------------
// localStorage ↔ SearchHistoryRow[] conversion
// ---------------------------------------------------------------------------

/**
 * Read all three localStorage stores and return them as SearchHistoryRow[].
 * Used as placeholderData so TanStack Query can show instant content.
 */
export function readLocalAsRows(): SearchHistoryRow[] {
  const books = bookHistoryStore.read();
  const movies = movieHistoryStore.read();
  const persons = personHistoryStore.read();

  const now = new Date().toISOString();

  return [
    ...books.map((b) => ({
      id: 0,
      user_id: "local",
      keyword: b.query,
      type: "book" as const,
      extra: { workId: b.workId, book: b.book } as Record<string, unknown>,
      searched_at: now,
    })),
    ...movies.map((m) => ({
      id: 0,
      user_id: "local",
      keyword: m.query,
      type: "movie" as const,
      extra: { subjectId: m.subjectId, movie: m.movie } as Record<string, unknown>,
      searched_at: now,
    })),
    ...persons.map((p) => ({
      id: 0,
      user_id: "local",
      keyword: p.name,
      type: p.kind as "author" | "celebrity",
      extra: { photoUrl: p.photoUrl, enName: p.enName, url: p.url, celebrityId: p.celebrityId } as Record<string, unknown>,
      searched_at: now,
    })),
  ];
}

/**
 * Write SearchHistoryRow[] back to the three localStorage stores.
 * Called when cloud data arrives so next load's placeholderData is fresh.
 */
export function writeRowsToLocal(rows: SearchHistoryRow[]) {
  const books: RecentSearchEntry[] = rows
    .filter((r) => r.type === "book" && r.extra?.workId && r.extra?.book)
    .map((r) => ({
      workId: r.extra.workId as string,
      query: r.keyword,
      book: r.extra.book as SearchBook,
    }))
    .slice(0, 10);
  bookHistoryStore.write(books);

  const movies: RecentMovieEntry[] = rows
    .filter((r) => r.type === "movie" && r.extra?.subjectId && r.extra?.movie)
    .map((r) => ({
      subjectId: r.extra.subjectId as string,
      query: r.keyword,
      movie: r.extra.movie as SearchMovie,
    }))
    .slice(0, 10);
  movieHistoryStore.write(movies);

  const persons: RecentPersonEntry[] = rows
    .filter((r) => r.type === "author" || r.type === "celebrity")
    .map((r) => ({
      kind: r.type as "author" | "celebrity",
      name: r.keyword,
      photoUrl: r.extra?.photoUrl as string | undefined,
      enName: r.extra?.enName as string | undefined,
      url: r.extra?.url as string | undefined,
      celebrityId: r.extra?.celebrityId as string | undefined,
    }))
    .slice(0, 12);
  personHistoryStore.write(persons);
}
