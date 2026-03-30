# Frodo API Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch book detail to Frodo JSON API (like movies) and add new fields: honor_infos, subject_collections, translator, catalog for books; honor_infos, high-res cover for movies.

**Architecture:** Two independent tracks — book API migration (switch from HTML parsing to Frodo JSON, add new fields) and movie API enrichment (add honor_infos + high-res cover to existing Frodo-based code). Both tracks update types → API → worker/proxy → UI → tests.

**Tech Stack:** TypeScript, React, Vitest, Cloudflare Workers, Vite dev proxy

---

### Task 1: Add new fields to book types

**Files:**
- Modify: `src/types/books.ts`

- [ ] **Step 1: Add HonorInfo and SubjectCollection types, extend BookDetail**

```typescript
// Add to src/types/books.ts

export interface HonorInfo {
  title: string;
  rank: number;
  kind: string;
}

export interface SubjectCollection {
  id: string;
  title: string;
}

export interface BookDetail {
  key: string;
  title: string;
  description?: string;         // was string | { value?: string }, now always string from Frodo
  firstPublishDate?: string;
  subjects?: string[];
  coverUrl?: string;
  authors?: string[];
  publisher?: string;
  pageCount?: number;
  ratingsAverage?: number;
  ratingsCount?: number;
  infoLink?: string;
  identifiers?: string[];
  originalTitle?: string;
  subtitle?: string;
  translator?: string[];        // NEW
  catalog?: string;             // NEW
  honorInfos?: HonorInfo[];     // NEW
  subjectCollections?: SubjectCollection[];  // NEW
}
```

Note: `description` type changes from `string | { value?: string }` to just `string` since Frodo returns plain string in `intro`. The `getTextValue` helper in the detail page already handles this, but after migration it will always be a plain string.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: May show errors in book-detail-page.tsx where `description` was `string | { value?: string }` — that's expected, will be fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/types/books.ts
git commit -m "feat(types): add honor_infos, subject_collections, translator, catalog to BookDetail"
```

---

### Task 2: Switch book detail API to Frodo JSON + add new fields

**Files:**
- Modify: `src/lib/books-api.ts`
- Modify: `worker/index.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Update worker — switch book detail route to Frodo API**

In `worker/index.ts`, replace the book detail route (the `bookMatch` block around line 80-84):

```typescript
const bookMatch = url.pathname.match(/^\/api\/douban\/book\/(\d+)\/?$/);
if (bookMatch) {
  const subjectId = bookMatch[1];
  const frodoHeaders = {
    "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
    Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
  };
  return proxyRequest(
    `https://frodo.douban.com/api/v2/book/${subjectId}?apikey=0ac44ae016490db2204ce0a042db2916`,
    request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
  );
}
```

- [ ] **Step 2: Update vite dev proxy — replace book detail proxy with Frodo middleware**

In `vite.config.ts`, remove the `/api/douban/book` proxy entry from `server.proxy`. Then add a new plugin (next to the existing `douban-movie-detail-proxy` plugin):

```typescript
{
  name: "douban-book-detail-proxy",
  configureServer(server) {
    const FRODO_HEADERS = {
      "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
      Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
    };

    server.middlewares.use(async (req, res, next) => {
      const match = req.url?.match(/^\/api\/douban\/book\/(\d+)\/?$/);
      if (!match) return next();

      const subjectId = match[1];
      const apikey = "0ac44ae016490db2204ce0a042db2916";

      try {
        const upstream = await fetch(
          `https://frodo.douban.com/api/v2/book/${subjectId}?apikey=${apikey}`,
          { headers: FRODO_HEADERS }
        );

        const body = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.end(body);
      } catch {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: "proxy error" }));
      }
    });
  }
},
```

- [ ] **Step 3: Rewrite getBookDetail in books-api.ts to use Frodo JSON**

Replace the `getBookDetail` function and remove all the now-dead HTML parsing helpers (`getInfoLines`, `getInfoValue`, `getLongestText`, `splitPeople`, `parseDoubanSearchHtml` stays — it's used by `searchBooks`). Add the Frodo response interface:

```typescript
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
```

Also remove the now-dead functions: `getInfoLines`, `getInfoValue`, `getLongestText`, `splitPeople`, `assertDoubanHtmlAvailable`, `textContent`, `parseRating`, `parseInteger`, `extractYear`, `decodeDoubanRedirect`, `extractSubjectId`, `parseSubjectCast`.

**Keep** only functions still used by `searchBooks` and `parseDoubanSearchHtml`: `normalizeUrl`, `proxifyImageUrl`, `fetchProxy`, `assertDoubanHtmlAvailable`, `parseRating`, `parseInteger`, `extractYear`, `textContent`, `decodeDoubanRedirect`, `extractSubjectId`, `parseSubjectCast`, `parseDoubanSearchHtml`. Check each before deleting.

- [ ] **Step 4: Fix book-detail-page.tsx — remove getTextValue usage**

In `src/routes/book-detail-page.tsx`, the `DetailDescriptionPanel` uses `getTextValue(bookDetail.description)`. Since `description` is now always a string from Frodo, simplify to just `bookDetail.description || fallbackBook?.description || ""`.

Remove the import of `getTextValue` from `@/lib/books-api`.

- [ ] **Step 5: Run type check and tests**

Run: `npx tsc --noEmit`
Expected: PASS

Start vite dev server, then run tests:
```bash
npx vite --port 5199 --strictPort &
sleep 2
VITE_DOUBAN_PROXY_BASE=http://localhost:5199 npx vitest run --reporter=verbose
kill %1
```
Expected: All book tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/books-api.ts worker/index.ts vite.config.ts src/routes/book-detail-page.tsx
git commit -m "refactor(books): switch book detail to Frodo JSON API

Replace HTML parsing with Frodo mobile API for book detail, matching
the approach already used for movies. Adds translator, catalog,
honorInfos, and subjectCollections fields. Removes dead HTML
parsing code (getInfoLines, getInfoValue, etc)."
```

---

### Task 3: Display new book fields in UI

**Files:**
- Modify: `src/routes/book-detail-page.tsx`

- [ ] **Step 1: Add honor badges to book detail hero panel**

In `DetailHeroPanel` (and `MobileHeroPanel`), after the existing badges (date, pages, rating), add honor info display:

```tsx
{bookDetail.honorInfos?.length ? (
  <div className="mt-3 flex flex-wrap items-center gap-2">
    {bookDetail.honorInfos.map((honor) => (
      <Badge key={honor.title} variant="accent" className="gap-1.5">
        #{honor.rank} {honor.title}
      </Badge>
    ))}
  </div>
) : null}
```

- [ ] **Step 2: Add translator to hero panel**

In `DetailHeroPanel`, after authors, add translator display if present:

```tsx
{bookDetail.translator?.length ? (
  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
    译者: {bookDetail.translator.join(" / ")}
  </p>
) : null}
```

- [ ] **Step 3: Add catalog to sidebar panel**

In `DetailSidebarPanel`, add a new collapsible catalog section if catalog exists:

```tsx
{bookDetail.catalog ? (
  <section className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-6">
    <h3 className="font-display text-xl font-medium sm:text-2xl">目录</h3>
    <p className="mt-4 max-h-48 overflow-y-auto whitespace-pre-line text-sm leading-7 text-[var(--muted-foreground)]">
      {bookDetail.catalog}
    </p>
  </section>
) : null}
```

- [ ] **Step 4: Add subject collections to sidebar panel**

In `DetailSidebarPanel`, after the existing subjects/tags section, add collections:

```tsx
{bookDetail.subjectCollections?.length ? (
  <section className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-6">
    <h3 className="font-display text-xl font-medium sm:text-2xl">上榜</h3>
    <div className="mt-4 flex flex-wrap gap-2">
      {bookDetail.subjectCollections.map((c) => (
        <Badge key={c.id}>{c.title}</Badge>
      ))}
    </div>
  </section>
) : null}
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/book-detail-page.tsx
git commit -m "feat(book-detail): display honor badges, translator, catalog, and collections"
```

---

### Task 4: Add new fields to movie types and API

**Files:**
- Modify: `src/types/movies.ts`
- Modify: `src/lib/movies-api.ts`

- [ ] **Step 1: Add HonorInfo to movie types, extend MovieDetail**

In `src/types/movies.ts`, add:

```typescript
export interface HonorInfo {
  title: string;
  rank: number;
  kind: string;
}
```

Add to `MovieDetail` interface:

```typescript
  honorInfos?: HonorInfo[];     // NEW
  coverLargeUrl?: string;       // NEW - high-res cover from cover.image.large
```

- [ ] **Step 2: Update FrodoMovieResponse and getMovieDetail in movies-api.ts**

Add to the `FrodoMovieResponse` interface:

```typescript
  honor_infos?: { title: string; rank: number; kind: string }[];
  cover?: { image?: { large?: { url: string } } };
```

In `getMovieDetail`, add the new fields to the return:

```typescript
  honorInfos: data.honor_infos?.map((h) => ({ title: h.title, rank: h.rank, kind: h.kind })),
  coverLargeUrl: proxifyImageUrl(data.cover?.image?.large?.url),
```

And update the existing `coverUrl` line to prefer `cover.image.large` for best quality:

```typescript
  coverUrl: proxifyImageUrl(data.cover?.image?.large?.url ?? data.pic?.large ?? data.cover_url),
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/types/movies.ts src/lib/movies-api.ts
git commit -m "feat(movies): add honor_infos and high-res cover to movie detail"
```

---

### Task 5: Display new movie fields in UI

**Files:**
- Modify: `src/routes/movie-detail-page.tsx`

- [ ] **Step 1: Add honor badges to movie detail hero panel**

In `DetailHeroPanel`, after the existing badges row, add honor info display (same pattern as books):

```tsx
{movieDetail.honorInfos?.length ? (
  <div className="mt-3 flex flex-wrap items-center gap-2">
    {movieDetail.honorInfos.map((honor) => (
      <Badge key={honor.title} variant="accent" className="gap-1.5">
        #{honor.rank} {honor.title}
      </Badge>
    ))}
  </div>
) : null}
```

Also add to `MobileHeroPanel` in the badges section.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/routes/movie-detail-page.tsx
git commit -m "feat(movie-detail): display honor badges in hero panel"
```

---

### Task 6: Update tests for new fields

**Files:**
- Modify: `src/lib/books-api.test.ts`
- Modify: `src/lib/movies-api.test.ts`

- [ ] **Step 1: Update book detail test to verify new fields**

In `books-api.test.ts`, update the "returns book detail for a known subject id" test:

```typescript
it("returns book detail for a known subject id", async () => {
  // 活着 by 余华 - a well-known book on Douban (via Frodo JSON API)
  const detail = await getBookDetail("4913064");

  expect(detail.key).toBe("4913064");
  expect(detail.title).toBeTruthy();
  expect(detail.authors).toBeInstanceOf(Array);
  expect(detail.authors!.length).toBeGreaterThan(0);
  expect(detail.description).toBeTruthy();
  expect(detail.infoLink).toContain("4913064");

  // New Frodo fields
  expect(detail.honorInfos).toBeInstanceOf(Array);
  expect(detail.subjectCollections).toBeInstanceOf(Array);
  expect(detail.translator).toBeInstanceOf(Array);
  expect(typeof detail.catalog === "string" || detail.catalog === undefined).toBe(true);
});
```

- [ ] **Step 2: Update movie detail test to verify new fields**

In `movies-api.test.ts`, update the "returns movie detail for a known subject id" test:

```typescript
it("returns movie detail for a known subject id", async () => {
  // 肖申克的救赎 - The Shawshank Redemption (via Frodo JSON API)
  const detail = await getMovieDetail("1292052");

  expect(detail.key).toBe("1292052");
  expect(detail.title).toBeTruthy();
  expect(detail.director).toBeInstanceOf(Array);
  expect(detail.director!.length).toBeGreaterThan(0);
  expect(detail.description).toBeTruthy();
  expect(detail.infoLink).toContain("1292052");

  // New Frodo fields
  expect(detail.honorInfos).toBeInstanceOf(Array);
  expect(detail.coverUrl).toBeTruthy();
});
```

- [ ] **Step 3: Run all tests**

```bash
npx vite --port 5199 --strictPort &
sleep 2
VITE_DOUBAN_PROXY_BASE=http://localhost:5199 npx vitest run --reporter=verbose
kill %1
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/books-api.test.ts src/lib/movies-api.test.ts
git commit -m "test(api): verify new Frodo fields in book and movie detail tests"
```

---

### Task 7: Clean up dead code

**Files:**
- Modify: `src/lib/books-api.ts` (if not already cleaned in Task 2)

- [ ] **Step 1: Verify no dead exports remain**

Check that `getTextValue` is no longer exported or imported anywhere:

```bash
npx grep -r "getTextValue" src/
```

If still referenced, remove the export from `books-api.ts` and all imports.

- [ ] **Step 2: Run final type check + tests**

```bash
npx tsc --noEmit
npx vite --port 5199 --strictPort &
sleep 2
VITE_DOUBAN_PROXY_BASE=http://localhost:5199 npx vitest run --reporter=verbose
kill %1
```

Expected: All pass, no type errors.

- [ ] **Step 3: Commit if any changes**

```bash
git add -A
git commit -m "refactor: remove dead getTextValue export and unused HTML parsing helpers"
```
