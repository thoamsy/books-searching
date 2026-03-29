import type { AuthorDetail, BookDetail, SearchBook, SearchResponse, SuggestItem } from "@/types/books";

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

export async function getBookDetail(workId: string): Promise<BookDetail> {
  const response = await fetchProxy(`/api/douban/book/${workId}/`);
  if (!response.ok) {
    throw new Error("Failed to fetch book details.");
  }

  const html = await response.text();
  assertDoubanHtmlAvailable(html);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const infoNode = doc.querySelector("#info");
  const infoLines = getInfoLines(infoNode);
  const description = getLongestText(doc.querySelectorAll(".related_info .intro"));
  const identifiers = [getInfoValue(infoLines, "ISBN"), getInfoValue(infoLines, "统一书号")]
    .filter(Boolean)
    .map((value) => value as string);
  const ratingText = textContent(doc.querySelector("strong.rating_num"));
  const ratingCountText = textContent(doc.querySelector("a.rating_people > span"));

  return {
    key: workId,
    title: textContent(doc.querySelector("#wrapper h1 span")) || "未知书名",
    subtitle: getInfoValue(infoLines, "副标题"),
    originalTitle: getInfoValue(infoLines, "原作名"),
    description,
    firstPublishDate: getInfoValue(infoLines, "出版年"),
    subjects: Array.from(doc.querySelectorAll("#db-tags-section a"))
      .map((node) => textContent(node))
      .filter(Boolean),
    coverUrl: proxifyImageUrl(doc.querySelector("#mainpic img")?.getAttribute("src") ?? undefined),
    authors: splitPeople(getInfoValue(infoLines, "作者")),
    publisher: getInfoValue(infoLines, "出版社"),
    pageCount: parseInteger(getInfoValue(infoLines, "页数")),
    ratingsAverage: parseRating(ratingText),
    ratingsCount: parseInteger(ratingCountText),
    infoLink: `https://book.douban.com/subject/${workId}/`,
    identifiers
  };
}

function getInfoLines(infoNode?: Element | null) {
  if (!infoNode) {
    return [];
  }

  const lines: string[] = [];
  let currentLine = "";

  infoNode.childNodes.forEach((node) => {
    if (node.nodeName === "BR") {
      const trimmed = currentLine.replace(/\s+/g, " ").trim();
      if (trimmed) {
        lines.push(trimmed);
      }
      currentLine = "";
      return;
    }

    currentLine += node.textContent ?? "";
  });

  const trailing = currentLine.replace(/\s+/g, " ").trim();
  if (trailing) {
    lines.push(trailing);
  }

  return lines;
}

function getInfoValue(lines: string[], label: string) {
  const normalizedLabel = label.replace(/[：:]/g, "");
  const line = lines.find((item) => item.replace(/\s+/g, "").startsWith(normalizedLabel));
  if (!line) {
    return "";
  }

  return line
    .replace(new RegExp(`^${label}\\s*[：:]?\\s*`), "")
    .replace(new RegExp(`^${normalizedLabel}\\s*[：:]?\\s*`), "")
    .trim();
}

function getLongestText(nodes: NodeListOf<Element>) {
  return Array.from(nodes)
    .map((node) => textContent(node))
    .sort((left, right) => right.length - left.length)[0] ?? "";
}

function splitPeople(value: string) {
  if (!value) {
    return [];
  }

  return value
    .split(/[\/,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

export async function getAuthorDetail(authorKey: string): Promise<AuthorDetail> {
  return {
    key: authorKey,
    name: authorKey
  };
}

export function getCoverUrl(coverUrl?: string) {
  return coverUrl ?? null;
}

export function normalizeWorkId(key: string) {
  return key.replace(/[^\d]/g, "");
}

export function getTextValue(value?: string | { value?: string }) {
  if (!value) {
    return "";
  }

  return typeof value === "string" ? value : value.value ?? "";
}
