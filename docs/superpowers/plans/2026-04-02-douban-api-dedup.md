# Douban API Deduplication & Frodo Search Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Replace HTML scraping search with Frodo `search/subjects` JSON API for both books and movies, eliminating the entire HTML parsing layer. (2) Extract shared utilities into `douban-shared.ts`. (3) Hoist repeated Worker constants.

**Architecture:** The Frodo API endpoint `https://frodo.douban.com/api/v2/search/subjects?q=...&type=book|movie&apikey=...` returns structured JSON with the same WeChat headers already used for detail endpoints. This replaces the fragile HTML parsing path (movie search is already broken — test is skipped). On the client side, shared utilities move to `douban-shared.ts`; HTML-only functions (`assertDoubanHtmlAvailable`, `textContent`, `decodeDoubanRedirect`, `extractSubjectId`, `parseRating`) are deleted entirely since they're only used by the HTML search parsers.

**Tech Stack:** TypeScript, Vitest, Cloudflare Worker

---

## Frodo Search API Reference

Tested and confirmed working:

```
GET https://frodo.douban.com/api/v2/search/subjects
  ?q=活着
  &type=book          # or "movie" — omit for mixed results
  &count=20
  &start=0
  &apikey=0ac44ae016490db2204ce0a042db2916
Headers: WeChat miniprogram (same as book/movie detail)
```

Response shape:
```json
{
  "subjects": {
    "total": 741,
    "start": 0,
    "count": 5,
    "items": [{
      "target_id": "4913064",
      "target_type": "book",
      "type_name": "图书",
      "target": {
        "id": "4913064",
        "title": "活着",
        "rating": { "value": 9.4, "count": 911016 },
        "cover_url": "https://img9.doubanio.com/view/subject/m/public/s29869926.jpg",
        "card_subtitle": "余华 / 2012 / 作家出版社",
        "year": "1994",           // movies only
        "has_linewatch": true      // movies only
      }
    }]
  }
}
```

`card_subtitle` format by type:
- **Books:** `"author / year / publisher"`
- **Movies:** `"country / genre1 genre2 / director / actor1 actor2"`

Fields NOT available: `description` (always empty `abstract`). Frontend never renders `description` in search results, so no UI impact.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/douban-shared.ts` | **Create** | `API_BASE`, `normalizeUrl`, `proxifyImageUrl`, `fetchProxy`, `extractCollectionId` |
| `src/lib/douban-shared.test.ts` | **Create** | Unit tests for shared utilities |
| `worker/index.ts` | **Modify** | Add Frodo search route, remove 2 HTML search routes, hoist `FRODO_HEADERS`/`REXXAR_HEADERS` |
| `src/lib/books-api.ts` | **Modify** | Rewrite `searchBooks` to use Frodo JSON; delete HTML parser + all HTML-only helpers |
| `src/lib/movies-api.ts` | **Modify** | Rewrite `searchMovies` to use Frodo JSON; delete HTML parser + all HTML-only helpers |
| `src/lib/collection-api.ts` | **Modify** | Import from `douban-shared` instead of `books-api` |
| `src/lib/books-api.test.ts` | **Modify** | Update assertions (ratingsCount now available) |
| `src/lib/movies-api.test.ts` | **Modify** | Un-skip movie search test |

### What gets deleted

These functions exist **only** because of HTML scraping. Once search uses Frodo JSON, they're dead code:

| Function | books-api | movies-api | Reason |
|----------|-----------|------------|--------|
| `assertDoubanHtmlAvailable` | ✓ | ✓ | Only checks HTML for rate-limit strings |
| `parseRating` | ✓ | ✓ | Parses rating from HTML text; Frodo returns `rating.value` as number |
| `textContent` | ✓ | ✓ | DOM text extraction from HTML |
| `decodeDoubanRedirect` | ✓ | ✓ | Unwraps Douban redirect URLs from HTML links |
| `extractSubjectId` | ✓ | ✓ | Extracts ID from HTML URLs; Frodo returns `target_id` directly |
| `parseInteger` | ✓ | ✓ | Already unused |
| `parseDoubanSearchHtml` | ✓ | — | HTML parser |
| `parseDoubanMovieSearchHtml` | — | ✓ | HTML parser (already broken) |
| `parseSubjectCast` | ✓ | — | Replaced by `card_subtitle` parser |
| `parseMovieSubjectCast` | — | ✓ | Replaced by `card_subtitle` parser |

### What stays in `douban-shared.ts`

Only the functions still needed after HTML removal:

- `API_BASE` — used by all API files
- `normalizeUrl` — used by `proxifyImageUrl`
- `proxifyImageUrl` — used by search, detail, and collection
- `fetchProxy` — used by search, detail, suggest, and collection
- `extractCollectionId` — used by book/movie detail for honor URIs

---

### Task 1: Create `douban-shared.ts` with shared utilities

**Files:**
- Create: `src/lib/douban-shared.ts`
- Create: `src/lib/douban-shared.test.ts`

- [ ] **Step 1: Write unit tests for shared utilities**

```ts
// src/lib/douban-shared.test.ts
import { describe, expect, it } from "vitest";
import {
  normalizeUrl,
  proxifyImageUrl,
  extractCollectionId,
} from "./douban-shared";

describe("douban-shared", () => {
  describe("normalizeUrl", () => {
    it("prepends https to protocol-relative URLs", () => {
      expect(normalizeUrl("//img.doubanio.com/pic.jpg")).toBe("https://img.doubanio.com/pic.jpg");
    });

    it("converts http to https", () => {
      expect(normalizeUrl("http://example.com/img.jpg")).toBe("https://example.com/img.jpg");
    });

    it("returns undefined for falsy input", () => {
      expect(normalizeUrl(undefined)).toBeUndefined();
      expect(normalizeUrl(null)).toBeUndefined();
      expect(normalizeUrl("")).toBeUndefined();
    });

    it("returns https URLs unchanged", () => {
      expect(normalizeUrl("https://example.com/img.jpg")).toBe("https://example.com/img.jpg");
    });
  });

  describe("proxifyImageUrl", () => {
    it("proxifies doubanio URLs", () => {
      const result = proxifyImageUrl("https://img3.doubanio.com/pic.jpg");
      expect(result).toContain("/api/douban/image?url=");
      expect(result).toContain(encodeURIComponent("https://img3.doubanio.com/pic.jpg"));
    });

    it("returns non-doubanio URLs as-is after normalizing", () => {
      expect(proxifyImageUrl("https://other.com/pic.jpg")).toBe("https://other.com/pic.jpg");
    });

    it("returns undefined for falsy input", () => {
      expect(proxifyImageUrl(undefined)).toBeUndefined();
    });
  });

  describe("extractCollectionId", () => {
    it("extracts collection ID from douban URI", () => {
      expect(
        extractCollectionId("douban://douban.com/subject_collection/ECZZABULI?source=xxx")
      ).toBe("ECZZABULI");
    });

    it("returns undefined for falsy input", () => {
      expect(extractCollectionId(undefined)).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `bun run test -- src/lib/douban-shared.test.ts`
Expected: FAIL — module `./douban-shared` does not exist yet.

- [ ] **Step 3: Create `douban-shared.ts`**

```ts
// src/lib/douban-shared.ts

export const API_BASE = (import.meta.env.VITE_DOUBAN_PROXY_BASE ?? "").replace(/\/$/, "");

export function normalizeUrl(url?: string | null) {
  if (!url) {
    return undefined;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  return url.replace("http://", "https://");
}

export function proxifyImageUrl(url?: string) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return undefined;
  }

  if (!normalized.includes("doubanio.com")) {
    return normalized;
  }

  return `${API_BASE}/api/douban/image?url=${encodeURIComponent(normalized)}`;
}

export function fetchProxy(path: string, accept = "text/html,application/xhtml+xml") {
  return fetch(`${API_BASE}${path}`, {
    headers: { Accept: accept },
  });
}

/** Extract collection ID from douban URI like "douban://douban.com/subject_collection/ECZZABULI?..." */
export function extractCollectionId(uri?: string): string | undefined {
  if (!uri) return undefined;
  const match = uri.match(/subject_collection\/([^?/]+)/);
  return match?.[1];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- src/lib/douban-shared.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/douban-shared.ts src/lib/douban-shared.test.ts
git commit -m "feat: extract shared douban utilities into douban-shared.ts"
```

---

### Task 2: Add Frodo search route to Worker + hoist header constants

**Files:**
- Modify: `worker/index.ts`

- [ ] **Step 1: Hoist headers to file-level constants (after line 12)**

```ts
const FRODO_HEADERS = {
  "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
  Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html",
};

const FRODO_APIKEY = "0ac44ae016490db2204ce0a042db2916";

const REXXAR_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  Referer: "https://m.douban.com/",
};
```

- [ ] **Step 2: Replace all 5 inline `frodoHeaders` and 2 inline `rexxarHeaders` with the constants**

Every `const frodoHeaders = { ... }` block in route handlers → use `FRODO_HEADERS` directly.
Every `const rexxarHeaders = { ... }` block → use `REXXAR_HEADERS` directly.
Replace all inline `apikey=0ac44ae016490db2204ce0a042db2916` with `apikey=${FRODO_APIKEY}`.

- [ ] **Step 3: Add Frodo search route, remove HTML search routes**

Remove these two route handlers:
```ts
// DELETE: /api/douban/search (HTML book search)
if (url.pathname === "/api/douban/search") { ... }

// DELETE: /api/douban/movie/search (HTML movie search)
if (url.pathname === "/api/douban/movie/search") { ... }
```

Add one new Frodo search route (place it near the other Frodo routes):
```ts
if (url.pathname === "/api/douban/search/subjects") {
  const query = url.searchParams.get("q") ?? "";
  const type = url.searchParams.get("type") ?? "";
  const start = url.searchParams.get("start") ?? "0";
  const count = url.searchParams.get("count") ?? "20";
  const target = new URL("https://frodo.douban.com/api/v2/search/subjects");
  target.searchParams.set("q", query);
  if (type) target.searchParams.set("type", type);
  target.searchParams.set("start", start);
  target.searchParams.set("count", count);
  target.searchParams.set("apikey", FRODO_APIKEY);
  return proxyRequest(target.toString(), request, {
    cacheTtl: 1800,
    extraHeaders: FRODO_HEADERS,
  });
}
```

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add worker/index.ts
git commit -m "feat(worker): add Frodo search route, remove HTML search routes, hoist header constants"
```

---

### Task 3: Rewrite `books-api.ts` — Frodo search + import from shared

**Files:**
- Modify: `src/lib/books-api.ts`

- [ ] **Step 1: Replace imports and delete HTML-only code**

Delete these functions entirely (only used by HTML parser):
- `normalizeUrl` (lines 5–15)
- `assertDoubanHtmlAvailable` (lines 43–48)
- `parseRating` (lines 50–57)
- `parseInteger` (lines 59–66)
- `textContent` (lines 73–75)
- `decodeDoubanRedirect` (lines 77–88)
- `extractSubjectId` (lines 90–92)
- `parseSubjectCast` (lines 94–105)
- `parseDoubanSearchHtml` (lines 107–134)

Delete `API_BASE` (line 3) and local `proxifyImageUrl` (lines 17–28) and `extractCollectionId` (lines 31–35) and `fetchProxy` (lines 37–41).

New top of file:

```ts
import type { BookDetail, SearchBook, SearchResponse, SuggestItem } from "@/types/books";
import {
  proxifyImageUrl,
  fetchProxy,
  extractCollectionId,
} from "@/lib/douban-shared";

// Re-export for consumers that import from books-api
export { proxifyImageUrl, extractCollectionId };
```

- [ ] **Step 2: Rewrite `searchBooks` to use Frodo JSON**

Replace the entire `searchBooks` function:

```ts
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
  // Format: "author / year / publisher" or "author1 author2 / year / publisher"
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
```

Keep `extractYear` only if still used elsewhere. Check: it's used nowhere after `parseSubjectCast` is deleted. **Delete `extractYear` too.**

- [ ] **Step 3: Run tests**

Run: `bun run test -- src/lib/books-api.test.ts`
Expected: All tests PASS. The `searchBooks` test expects `numFound > 0`, `docs[0].key` truthy, `docs[0].title` truthy — all satisfied by Frodo response.

- [ ] **Step 4: Type check**

Run: `bunx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/books-api.ts
git commit -m "refactor: replace HTML search with Frodo JSON API in books-api"
```

---

### Task 4: Rewrite `movies-api.ts` — Frodo search + import from shared

**Files:**
- Modify: `src/lib/movies-api.ts`

- [ ] **Step 1: Replace imports and delete HTML-only code**

Delete these functions entirely:
- `normalizeUrl` (lines 6–16)
- local `proxifyImageUrl` (lines 18–29)
- `API_BASE` (line 4)
- `fetchProxy` (lines 31–35)
- `assertDoubanHtmlAvailable` (lines 37–42)
- `parseRating` (lines 44–51)
- `parseInteger` (lines 53–60)
- `textContent` (lines 62–64)
- `decodeDoubanRedirect` (lines 66–77)
- `extractSubjectId` (lines 79–81)
- `parseMovieSubjectCast` (lines 83–95)
- `parseDoubanMovieSearchHtml` (lines 97–129)

Replace import:
```ts
import { extractCollectionId } from "@/lib/books-api";
```
With:
```ts
import {
  proxifyImageUrl,
  fetchProxy,
  extractCollectionId,
} from "@/lib/douban-shared";
```

- [ ] **Step 2: Rewrite `searchMovies` to use Frodo JSON**

```ts
interface FrodoSearchTarget {
  id: string;
  title: string;
  rating?: { value?: number; count?: number };
  cover_url?: string;
  card_subtitle?: string;
  year?: string;
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

function parseMovieCardSubtitle(subtitle?: string) {
  if (!subtitle) return { director: [], cast: [] };
  const parts = subtitle.split("/").map((s) => s.trim()).filter(Boolean);
  // Format: "country / genre1 genre2 / director / actor1 actor2"
  // Minimum: "country / director" or just "director"
  if (parts.length >= 4) {
    return {
      director: parts[2] ? [parts[2]] : [],
      cast: parts.slice(3),
    };
  }
  return { director: [], cast: [] };
}

export async function searchMovies(query: string, limit = 18): Promise<MovieSearchResponse> {
  const response = await fetchProxy(
    `/api/douban/search/subjects?type=movie&q=${encodeURIComponent(query)}&count=${limit}`,
    "application/json"
  );
  if (!response.ok) {
    throw new Error("Failed to search movies.");
  }

  const data: FrodoSearchResponse = await response.json();
  const items = data.subjects?.items ?? [];

  const docs: SearchMovie[] = items.map((item) => {
    const t = item.target;
    const parsed = parseMovieCardSubtitle(t.card_subtitle);
    return {
      key: item.target_id,
      title: t.title || "未知影片",
      coverUrl: proxifyImageUrl(t.cover_url),
      year: t.year?.match(/\d{4}/)?.[0],
      ratingsAverage: t.rating?.value || undefined,
      ratingsCount: t.rating?.count || undefined,
      director: parsed.director,
      cast: parsed.cast,
      type: item.target_type === "tv" ? "tv" : "movie",
      externalUrl: `https://movie.douban.com/subject/${item.target_id}/`,
    };
  });

  return { numFound: data.subjects?.total ?? docs.length, docs };
}
```

- [ ] **Step 3: Run tests**

Run: `bun run test -- src/lib/movies-api.test.ts`
Expected: All tests PASS.

- [ ] **Step 4: Type check**

Run: `bunx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/movies-api.ts
git commit -m "refactor: replace HTML search with Frodo JSON API in movies-api"
```

---

### Task 5: Update `collection-api.ts` imports

**Files:**
- Modify: `src/lib/collection-api.ts`

- [ ] **Step 1: Switch import source and use `fetchProxy`**

Change:
```ts
import { proxifyImageUrl } from "@/lib/books-api";
```
To:
```ts
import { proxifyImageUrl, fetchProxy } from "@/lib/douban-shared";
```

Change the `fetch()` call in `getCollectionItems` (line 91):
```ts
const response = await fetch(
  `/api/douban/collection/${collectionId}/items?start=${start}&count=${count}`
);
```
To:
```ts
const response = await fetchProxy(
  `/api/douban/collection/${collectionId}/items?start=${start}&count=${count}`,
  "application/json"
);
```

- [ ] **Step 2: Type check**

Run: `bunx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/collection-api.ts
git commit -m "refactor: collection-api imports from douban-shared, uses fetchProxy"
```

---

### Task 6: Update tests + un-skip movie search

**Files:**
- Modify: `src/lib/movies-api.test.ts`
- Modify: `src/lib/books-api.test.ts`

- [ ] **Step 1: Un-skip movie search test**

In `movies-api.test.ts`, change:
```ts
// Douban movie search now uses client-side rendering (JS loads results).
// HTML parsing cannot extract results. Book search still uses server-rendered HTML.
it.skip("returns search results with expected shape", async () => {
```
To:
```ts
it("returns search results with expected shape", async () => {
```

Remove the comment about client-side rendering — no longer relevant since we use Frodo JSON.

- [ ] **Step 2: Run full test suite**

Run: `bun run test`
Expected: All tests PASS, including the previously-skipped movie search test.

- [ ] **Step 3: Commit**

```bash
git add src/lib/movies-api.test.ts src/lib/books-api.test.ts
git commit -m "test: un-skip movie search test, now using Frodo JSON API"
```

---

### Task 7: Final verification

**Files:** (no changes — verification only)

- [ ] **Step 1: Type check**

Run: `bunx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 2: Full build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Run all tests**

Run: `bun run test`
Expected: All tests pass.

- [ ] **Step 4: Verify no stale imports**

Check that no file still imports HTML-only functions that were deleted:
- `assertDoubanHtmlAvailable` — should have zero references
- `parseRating` — should have zero references
- `textContent` — should have zero references
- `decodeDoubanRedirect` — should have zero references
- `extractSubjectId` — should have zero references

---

## Summary of Impact

| Before | After |
|--------|-------|
| 3 API styles (browser HTML + Frodo JSON + Rexxar JSON) | 2 API styles (Frodo JSON + Rexxar JSON) |
| Movie search broken (HTML is client-rendered) | Movie search works via Frodo JSON |
| 9 duplicated functions across books-api + movies-api | 5 shared functions in douban-shared.ts |
| `frodoHeaders` repeated 5× in Worker | 1 `FRODO_HEADERS` constant |
| `rexxarHeaders` repeated 2× in Worker | 1 `REXXAR_HEADERS` constant |
| ~200 lines of HTML parsing code (DOMParser, regex, redirect decoding) | Deleted |
| `collection-api.ts` uses bare `fetch()` | Uses `fetchProxy` consistently |

### What's NOT changing
- Suggest endpoints (book + movie) — they use different Douban APIs (`/j/subject_suggest`) that return different shapes; they serve autocomplete, not search
- Detail endpoints — already use Frodo JSON
- Collection endpoints — already use Rexxar JSON
- Worker image proxy — unchanged
