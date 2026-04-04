# Digital Availability Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "在哪里看/读" (Where to read/watch) sections to book and movie detail pages, showing search links to major Chinese digital platforms.

**Architecture:** Pure frontend — no new API calls. Construct search URLs from existing book title/ISBN and movie title data, render as a styled link grid in both detail pages. Extract shared platform-link component for reuse across book and movie pages.

**Tech Stack:** React, Tailwind CSS, Lucide icons (existing stack — no new dependencies)

---

## Research Summary

Most Chinese digital platforms (微信读书, 得到, 爱奇艺, 腾讯视频, 优酷) have **no public API** for checking availability. The practical approach is to generate **search URLs** that open each platform's search page pre-filled with the book/movie title. This is what Douban itself does for purchase links.

### Platform URL Patterns

**Books:**
| Platform | URL Pattern |
|----------|-------------|
| 微信读书 | `https://weread.qq.com/web/search/books?keyword={QUERY}` |
| 豆瓣读书 | `https://book.douban.com/subject/{ID}/` (already have this as `infoLink`) |
| 得到 | `https://www.dedao.cn/search/result?q={QUERY}` |
| 京东读书 | `https://search.jd.com/Search?keyword={QUERY}&enc=utf-8&book=y` |
| 当当 | `http://search.dangdang.com/?key={QUERY}&act=input` |

**Movies/TV:**
| Platform | URL Pattern |
|----------|-------------|
| Bilibili | `https://search.bilibili.com/all?keyword={QUERY}` |
| 爱奇艺 | `https://so.iqiyi.com/so/q_{QUERY}` |
| 腾讯视频 | `https://v.qq.com/x/search/?q={QUERY}` |
| 优酷 | `https://so.youku.com/search_video/q_{QUERY}` |
| 芒果TV | `https://so.mgtv.com/so?k={QUERY}` |

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/platform-links.ts` | Platform definitions + URL builder functions for books and movies |
| Create | `src/components/platform-links.tsx` | `<PlatformLinks>` component — renders a grid of platform search links |
| Modify | `src/routes/book-detail-page.tsx` | Add `<PlatformLinks>` to sidebar panel |
| Modify | `src/routes/movie-detail-page.tsx` | Add `<PlatformLinks>` to sidebar panel |
| Create | `src/lib/__tests__/platform-links.test.ts` | Unit tests for URL builder functions |

---

### Task 1: Platform Link URL Builders

**Files:**
- Create: `src/lib/platform-links.ts`
- Create: `src/lib/__tests__/platform-links.test.ts`

- [ ] **Step 1: Write the failing tests for book platform links**

```ts
// src/lib/__tests__/platform-links.test.ts
import { describe, expect, it } from "vitest";
import { getBookPlatformLinks, getMoviePlatformLinks } from "../platform-links";

describe("getBookPlatformLinks", () => {
  it("generates correct search URLs for a book title", () => {
    const links = getBookPlatformLinks({ title: "三体" });
    expect(links).toEqual([
      { name: "微信读书", url: "https://weread.qq.com/web/search/books?keyword=%E4%B8%89%E4%BD%93" },
      { name: "得到", url: "https://www.dedao.cn/search/result?q=%E4%B8%89%E4%BD%93" },
      { name: "京东读书", url: "https://search.jd.com/Search?keyword=%E4%B8%89%E4%BD%93&enc=utf-8&book=y" },
      { name: "当当", url: "https://search.dangdang.com/?key=%E4%B8%89%E4%BD%93&act=input" },
    ]);
  });

  it("uses ISBN in query when available", () => {
    const links = getBookPlatformLinks({ title: "三体", isbn: "9787536692930" });
    // ISBN should be appended to search for more precise results
    expect(links[0].url).toContain("9787536692930");
  });
});

describe("getMoviePlatformLinks", () => {
  it("generates correct search URLs for a movie title", () => {
    const links = getMoviePlatformLinks({ title: "流浪地球" });
    expect(links).toEqual([
      { name: "Bilibili", url: "https://search.bilibili.com/all?keyword=%E6%B5%81%E6%B5%AA%E5%9C%B0%E7%90%83" },
      { name: "爱奇艺", url: "https://so.iqiyi.com/so/q_%E6%B5%81%E6%B5%AA%E5%9C%B0%E7%90%83" },
      { name: "腾讯视频", url: "https://v.qq.com/x/search/?q=%E6%B5%81%E6%B5%AA%E5%9C%B0%E7%90%83" },
      { name: "优酷", url: "https://so.youku.com/search_video/q_%E6%B5%81%E6%B5%AA%E5%9C%B0%E7%90%83" },
      { name: "芒果TV", url: "https://so.mgtv.com/so?k=%E6%B5%81%E6%B5%AA%E5%9C%B0%E7%90%83" },
    ]);
  });

  it("returns empty array when title is empty", () => {
    const links = getMoviePlatformLinks({ title: "" });
    expect(links).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/platform-links.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the platform link builders**

```ts
// src/lib/platform-links.ts

export interface PlatformLink {
  name: string;
  url: string;
}

interface BookLinkInput {
  title: string;
  isbn?: string;
}

interface MovieLinkInput {
  title: string;
}

export function getBookPlatformLinks({ title, isbn }: BookLinkInput): PlatformLink[] {
  if (!title) return [];

  // Prefer ISBN for search precision when available
  const query = isbn ?? title;
  const encoded = encodeURIComponent(query);

  return [
    { name: "微信读书", url: `https://weread.qq.com/web/search/books?keyword=${encoded}` },
    { name: "得到", url: `https://www.dedao.cn/search/result?q=${encoded}` },
    { name: "京东读书", url: `https://search.jd.com/Search?keyword=${encoded}&enc=utf-8&book=y` },
    { name: "当当", url: `https://search.dangdang.com/?key=${encoded}&act=input` },
  ];
}

export function getMoviePlatformLinks({ title }: MovieLinkInput): PlatformLink[] {
  if (!title) return [];

  const encoded = encodeURIComponent(title);

  return [
    { name: "Bilibili", url: `https://search.bilibili.com/all?keyword=${encoded}` },
    { name: "爱奇艺", url: `https://so.iqiyi.com/so/q_${encoded}` },
    { name: "腾讯视频", url: `https://v.qq.com/x/search/?q=${encoded}` },
    { name: "优酷", url: `https://so.youku.com/search_video/q_${encoded}` },
    { name: "芒果TV", url: `https://so.mgtv.com/so?k=${encoded}` },
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/platform-links.test.ts`
Expected: PASS (all tests green)

Note: The test for ISBN may need adjustment — if `isbn` is provided, `getBookPlatformLinks` uses it as the query instead of title, so the first test (no ISBN) uses title, and the second test uses ISBN. Verify the test assertions match the implementation.

- [ ] **Step 5: Commit**

```bash
git add src/lib/platform-links.ts src/lib/__tests__/platform-links.test.ts
git commit -m "feat: add platform link URL builders for books and movies"
```

---

### Task 2: PlatformLinks Component

**Files:**
- Create: `src/components/platform-links.tsx`

- [ ] **Step 1: Create the PlatformLinks component**

This component renders a grid of external links styled to match the existing detail page aesthetic (rounded cards with `var(--surface)` background).

```tsx
// src/components/platform-links.tsx
import { ExternalLink } from "lucide-react";
import type { PlatformLink } from "@/lib/platform-links";

interface PlatformLinksProps {
  title: string;
  links: PlatformLink[];
}

export function PlatformLinks({ title, links }: PlatformLinksProps) {
  if (links.length === 0) return null;

  return (
    <section className="rounded-[32px] border border-white/70 bg-[var(--surface)] p-6">
      <h3 className="font-display text-xl font-medium sm:text-2xl">{title}</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/20 bg-[var(--primary)]/[0.05] px-3 py-1.5 text-sm font-medium text-[var(--primary)] transition-all hover:-translate-y-px hover:border-[var(--primary)]/35 hover:bg-[var(--primary)]/[0.1] hover:shadow-[0_4px_12px_color-mix(in_oklch,var(--primary)_10%,transparent)]"
          >
            {link.name}
            <ExternalLink className="size-3.5" />
          </a>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/platform-links.tsx
git commit -m "feat: add PlatformLinks component for external search links"
```

---

### Task 3: Integrate into Book Detail Page

**Files:**
- Modify: `src/routes/book-detail-page.tsx:270-335` (DetailSidebarPanel)

- [ ] **Step 1: Add imports to book-detail-page.tsx**

Add these imports at the top of `src/routes/book-detail-page.tsx`:

```tsx
import { PlatformLinks } from "@/components/platform-links";
import { getBookPlatformLinks } from "@/lib/platform-links";
```

- [ ] **Step 2: Add PlatformLinks to the DetailSidebarPanel**

In the `DetailSidebarPanel` function in `src/routes/book-detail-page.tsx`, add the platform links section. Insert it as the first child of the `<aside>` element, before the subjects section.

Compute the links and extract ISBN from identifiers:

```tsx
// Inside DetailSidebarPanel, before the return statement:
const isbn = bookDetail.identifiers?.find((id) => /^97[89]\d{10}$/.test(id.replace(/-/g, "")));
const platformLinks = getBookPlatformLinks({ title: bookDetail.title, isbn });
```

Then add `<PlatformLinks title="去哪里读" links={platformLinks} />` as the first child inside `<aside className="space-y-6">`.

- [ ] **Step 3: Verify it renders correctly**

Run: `npm run dev`
Open a book detail page (e.g., `/book/1234`) and verify:
- The "去哪里读" section appears at the top of the sidebar
- Each platform link opens the correct search URL in a new tab
- The styling matches the existing sections (rounded cards, consistent spacing)

- [ ] **Step 4: Commit**

```bash
git add src/routes/book-detail-page.tsx
git commit -m "feat: add digital reading platform links to book detail page"
```

---

### Task 4: Integrate into Movie Detail Page

**Files:**
- Modify: `src/routes/movie-detail-page.tsx:300-365` (DetailSidebarPanel)

- [ ] **Step 1: Add imports to movie-detail-page.tsx**

Add these imports at the top of `src/routes/movie-detail-page.tsx`:

```tsx
import { PlatformLinks } from "@/components/platform-links";
import { getMoviePlatformLinks } from "@/lib/platform-links";
```

- [ ] **Step 2: Add PlatformLinks to the DetailSidebarPanel**

In the `DetailSidebarPanel` function in `src/routes/movie-detail-page.tsx`, compute the links and add the section. Insert it as the first child of the `<aside>` element, before the genres section.

```tsx
// Inside DetailSidebarPanel, before the return statement:
const platformLinks = getMoviePlatformLinks({ title: movieDetail.title });
```

Then add `<PlatformLinks title="去哪里看" links={platformLinks} />` as the first child inside `<aside className="space-y-6">`.

- [ ] **Step 3: Verify it renders correctly**

Run: `npm run dev`
Open a movie detail page (e.g., `/movie/1234`) and verify:
- The "去哪里看" section appears at the top of the sidebar
- Each platform link opens the correct search URL in a new tab
- Styling is consistent with the book detail page version

- [ ] **Step 4: Commit**

```bash
git add src/routes/movie-detail-page.tsx
git commit -m "feat: add streaming platform links to movie detail page"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run type checking**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Test edge cases manually**

- Book with no identifiers (ISBN) — should still show links using title
- Movie with very long title — links should wrap properly
- TV show — same links as movie (streaming platforms carry both)

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address edge cases in platform links"
```
