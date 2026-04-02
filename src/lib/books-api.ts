import type { BookDetail, SearchBook, SearchResponse, SuggestItem } from "@/types/books";
import {
  proxifyImageUrl,
  fetchProxy,
  extractCollectionId,
} from "@/lib/douban-shared";

// Re-export for consumers that import from books-api
export { proxifyImageUrl, extractCollectionId };

interface FrodoSearchTarget {
  id: string;
  title: string;
  rating?: { value?: number; count?: number };
  cover_url?: string;
  card_subtitle?: string;
}

interface FrodoSearchResponse {
  subjects: {
    total: number;
    start: number;
    count: number;
    items: {
      target_id: string;
      target_type: string;
      target: FrodoSearchTarget;
    }[];
  };
}

function parseBookCardSubtitle(subtitle?: string) {
  if (!subtitle) return { authors: [], publisher: undefined, year: undefined };
  const parts = subtitle.split("/").map((s) => s.trim()).filter(Boolean);
  // Format: "author / year / publisher"
  const year = parts[parts.length - 2]?.match(/\d{4}/)?.[0];
  const publisher = parts[parts.length - 1];
  const authors = parts.slice(0, Math.max(0, parts.length - 2));
  return {
    authors,
    publisher,
    year: year ? Number(year) : undefined,
  };
}

export async function searchBooks(query: string, limit = 18): Promise<SearchResponse> {
  const response = await fetchProxy(
    `/api/douban/search/subjects?type=book&q=${encodeURIComponent(query)}&count=${limit}`,
    "application/json"
  );
  if (!response.ok) {
    throw new Error("Failed to search books.");
  }

  const data: FrodoSearchResponse = await response.json();
  const items = data.subjects?.items ?? [];

  const docs: SearchBook[] = items.map((item) => {
    const t = item.target;
    const parsed = parseBookCardSubtitle(t.card_subtitle);
    return {
      key: item.target_id,
      title: t.title || "未知书名",
      authorName: parsed.authors,
      coverUrl: proxifyImageUrl(t.cover_url),
      firstPublishYear: parsed.year,
      ratingsAverage: t.rating?.value || undefined,
      ratingsCount: t.rating?.count || undefined,
      publisher: parsed.publisher,
      externalUrl: `https://book.douban.com/subject/${item.target_id}/`,
    };
  });

  return { numFound: data.subjects?.total ?? docs.length, docs };
}

interface DoubanSuggestEntry {
  type: "a" | "b";
  id: string;
  title: string;
  url: string;
  pic?: string;
  author_name?: string;
  year?: string;
  en_name?: string;
}

export async function getSuggestions(query: string): Promise<SuggestItem[]> {
  const response = await fetchProxy(`/api/douban/suggest?q=${encodeURIComponent(query)}`, "application/json");
  if (!response.ok) {
    throw new Error("Failed to fetch suggestions.");
  }

  const data: DoubanSuggestEntry[] = await response.json();

  return data.map((entry) => ({
    type: entry.type === "a" ? "author" : "book",
    id: entry.id,
    title: entry.title,
    url: entry.url,
    coverUrl: proxifyImageUrl(entry.pic),
    authorName: entry.author_name,
    year: entry.year,
    enName: entry.en_name
  }));
}

interface FrodoBookResponse {
  id: string;
  title: string;
  original_title?: string;
  subtitle?: string[];
  intro?: string;
  author?: string[];
  translator?: string[];
  press?: string[];
  pubdate?: string[];
  pages?: string[];
  price?: string[];
  pic?: { large?: string; normal?: string };
  cover_url?: string;
  rating?: { value?: number; count?: number };
  catalog?: string;
  honor_infos?: { title: string; rank: number; kind: string; uri?: string }[];
  subject_collections?: { id: string; title: string; uri?: string }[];
  tags?: { name: string }[];
}

export async function getBookDetail(workId: string): Promise<BookDetail> {
  const response = await fetchProxy(`/api/douban/book/${workId}/`, "application/json");
  if (!response.ok) {
    throw new Error("Failed to fetch book details.");
  }

  const data: FrodoBookResponse = await response.json();

  return {
    key: workId,
    title: data.title || "未知书名",
    originalTitle: data.original_title,
    subtitle: data.subtitle?.[0],
    description: data.intro,
    firstPublishDate: data.pubdate?.[0],
    authors: data.author ?? [],
    translator: data.translator ?? [],
    publisher: data.press?.[0],
    pageCount: data.pages?.[0] ? Number.parseInt(data.pages[0], 10) || undefined : undefined,
    ratingsAverage: data.rating?.value,
    ratingsCount: data.rating?.count,
    subjects: data.tags?.map((t) => t.name) ?? [],
    coverUrl: proxifyImageUrl(data.pic?.large ?? data.cover_url),
    catalog: data.catalog,
    honorInfos: data.honor_infos?.map((h) => ({
      title: h.title,
      rank: h.rank,
      kind: h.kind,
      collectionId: extractCollectionId(h.uri)
    })),
    subjectCollections: data.subject_collections?.map((c) => ({ id: c.id, title: c.title })),
    infoLink: `https://book.douban.com/subject/${workId}/`
  };
}

export function suggestItemToSearchBook(item: SuggestItem): SearchBook {
  return {
    key: item.id,
    title: item.title,
    authorName: item.authorName ? [item.authorName] : [],
    coverUrl: item.coverUrl,
    firstPublishYear: item.year ? Number(item.year) : undefined,
    externalUrl: item.url
  };
}

export function getCoverUrl(coverUrl?: string) {
  return coverUrl ?? null;
}

export function normalizeWorkId(key: string) {
  return key.replace(/[^\d]/g, "");
}
