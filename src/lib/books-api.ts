import type { BookDetail, SearchBook, SearchResponse, SuggestItem } from "@/types/books";

const API_BASE = (import.meta.env.VITE_DOUBAN_PROXY_BASE ?? "").replace(/\/$/, "");

function normalizeUrl(url?: string | null) {
  if (!url) {
    return undefined;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  return url.replace("http://", "https://");
}

function proxifyImageUrl(url?: string) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return undefined;
  }

  if (!normalized.includes("doubanio.com")) {
    return normalized;
  }

  return `${API_BASE}/api/douban/image?url=${encodeURIComponent(normalized)}`;
}

function fetchProxy(path: string, accept = "text/html,application/xhtml+xml") {
  return fetch(`${API_BASE}${path}`, {
    headers: { Accept: accept }
  });
}

function assertDoubanHtmlAvailable(html: string) {
  const blockedSignals = ["异常请求", "验证码", "security verification", "检测到有异常请求", "登录跳转豆瓣"];
  if (blockedSignals.some((signal) => html.includes(signal))) {
    throw new Error("Douban rate-limited or challenged the request.");
  }
}

function parseRating(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const rating = Number.parseFloat(value.trim());
  return Number.isFinite(rating) ? rating : undefined;
}

function parseInteger(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractYear(value?: string | null) {
  const year = value?.match(/\d{4}/)?.[0];
  return year ? Number(year) : undefined;
}

function textContent(node?: Element | null) {
  return node?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function decodeDoubanRedirect(url?: string | null) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url, "https://www.douban.com");
    return parsed.searchParams.get("url") ?? url;
  } catch {
    return url;
  }
}

function extractSubjectId(url?: string | null) {
  return url?.match(/subject\/(\d+)/)?.[1] ?? "";
}

function parseSubjectCast(value: string) {
  const parts = value
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  const year = parts[parts.length - 1] ?? "";
  const publisher = parts[parts.length - 2] ?? "";
  const authors = parts.slice(0, Math.max(0, parts.length - 2));

  return { year, publisher, authors };
}

function parseDoubanSearchHtml(html: string): SearchResponse {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const docs = Array.from(doc.querySelectorAll("div.result")).map((item) => {
    const redirectUrl =
      (item.querySelector("div.title a") as HTMLAnchorElement | null)?.getAttribute("href") ??
      (item.querySelector("div.content a") as HTMLAnchorElement | null)?.getAttribute("href") ??
      "";
    const externalUrl = decodeDoubanRedirect(redirectUrl);
    const subjectId = extractSubjectId(externalUrl);
    const cast = parseSubjectCast(textContent(item.querySelector("span.subject-cast")));
    const ratingText = textContent(item.querySelector("span.rating_nums"));
    const description = textContent(item.querySelector("p"));

  return {
      key: subjectId,
      title: textContent(item.querySelector("div.title a")) || "未知书名",
      authorName: cast.authors,
      coverUrl: proxifyImageUrl(item.querySelector("img")?.getAttribute("src") ?? undefined),
      firstPublishYear: extractYear(cast.year),
      ratingsAverage: parseRating(ratingText),
      publisher: cast.publisher,
      description,
      externalUrl
    } satisfies SearchBook;
  });

  return { numFound: docs.length, docs: docs.filter((doc) => doc.key) };
}

export async function searchBooks(query: string, limit = 18): Promise<SearchResponse> {
  const response = await fetchProxy(`/api/douban/search?cat=1001&q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error("Failed to search books.");
  }

  const html = await response.text();
  assertDoubanHtmlAvailable(html);
  const data = parseDoubanSearchHtml(html);

  return {
    numFound: data.numFound,
    docs: data.docs.slice(0, limit)
  };
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
  honor_infos?: { title: string; rank: number; kind: string }[];
  subject_collections?: { id: string; title: string }[];
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
    honorInfos: data.honor_infos?.map((h) => ({ title: h.title, rank: h.rank, kind: h.kind })),
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

