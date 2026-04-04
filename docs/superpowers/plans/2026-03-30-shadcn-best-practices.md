# shadcn/ui Best Practices Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all shadcn/ui usage in the project up to best-practice standards — eliminate `space-y-*`, replace manual skeletons with `Skeleton` component, fix raw colors, fix icon usage, and use `cn()` for conditional classes.

**Architecture:** Five categories of fixes applied file-by-file: (1) install missing shadcn components, (2) replace `space-y-*` with `flex flex-col gap-*`, (3) replace `animate-pulse` divs with `Skeleton`, (4) fix raw colors to semantic tokens/CSS variables, (5) fix icon `data-icon` and `cn()` usage. Each task is scoped to one file or one concern.

**Tech Stack:** React, Tailwind CSS v4, shadcn/ui (radix-nova style, radix base), Vite, bun

---

### Task 1: Install missing shadcn components (`skeleton`)

**Files:**
- Create: `src/components/ui/skeleton.tsx` (via CLI)

- [ ] **Step 1: Install Skeleton component**

```bash
bunx --bun shadcn@latest add skeleton
```

- [ ] **Step 2: Verify installation**

```bash
ls src/components/ui/skeleton.tsx
```

Expected: file exists

- [ ] **Step 3: Read the installed component to verify correctness**

Read `src/components/ui/skeleton.tsx` and confirm it exports a `Skeleton` component.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/skeleton.tsx
git commit -m "feat(ui): add shadcn Skeleton component"
```

---

### Task 2: Fix `space-y-*` → `flex flex-col gap-*` in `book-detail-page.tsx`

**Files:**
- Modify: `src/routes/book-detail-page.tsx`

Replace every `space-y-N` with `flex flex-col gap-N`. The key replacements:

- [ ] **Step 1: Replace all `space-y-*` occurrences**

Find and replace each instance. Examples of the changes:

| Line (approx) | Old | New |
|---|---|---|
| 52 | `className="space-y-10"` | `className="flex flex-col gap-10"` |
| 62 | `animate-fade-up mt-6 space-y-6` | `animate-fade-up mt-6 flex flex-col gap-6` |
| 100 | `className="space-y-10"` | `className="flex flex-col gap-10"` |
| 110 | `mt-6 space-y-6 lg:hidden` | `mt-6 flex flex-col gap-6 lg:hidden` |
| 289 | `className="space-y-6"` on `<aside>` | `className="flex flex-col gap-6"` |
| 327 | `mt-4 space-y-4` | `mt-4 flex flex-col gap-4` |
| 445 | `className="space-y-2"` | `className="flex flex-col gap-2"` |
| 490 | `mt-4 space-y-3` | `mt-4 flex flex-col gap-3` |
| 523 | `mt-6 space-y-4` | `mt-6 flex flex-col gap-4` |
| 539 | `className="space-y-6"` on `<aside>` | `className="flex flex-col gap-6"` |
| 551 | `mt-4 space-y-5` | `mt-4 flex flex-col gap-5` |
| 553 | `className="space-y-2"` | `className="flex flex-col gap-2"` |

- [ ] **Step 2: Visual verify in dev**

```bash
# Open the book detail page in dev server and confirm layout unchanged
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/book-detail-page.tsx
git commit -m "refactor(book-detail): replace space-y-* with flex flex-col gap-*"
```

---

### Task 3: Fix `space-y-*` → `flex flex-col gap-*` in `movie-detail-page.tsx`

**Files:**
- Modify: `src/routes/movie-detail-page.tsx`

Same pattern as Task 2. Key replacements:

- [ ] **Step 1: Replace all `space-y-*` occurrences**

| Line (approx) | Old | New |
|---|---|---|
| 54 | `className="space-y-10"` | `className="flex flex-col gap-10"` |
| 64 | `animate-fade-up mt-6 space-y-6` | `animate-fade-up mt-6 flex flex-col gap-6` |
| 102 | `className="space-y-10"` | `className="flex flex-col gap-10"` |
| 112 | `mt-6 space-y-6 lg:hidden` | `mt-6 flex flex-col gap-6 lg:hidden` |
| 320 | `className="space-y-6"` on `<aside>` | `className="flex flex-col gap-6"` |
| 341 | `mt-4 space-y-4` | `mt-4 flex flex-col gap-4` |
| 502 | `className="space-y-2"` | `className="flex flex-col gap-2"` |
| 552 | `mt-4 space-y-3` | `mt-4 flex flex-col gap-3` |
| 574 | `mt-6 space-y-4` | `mt-6 flex flex-col gap-4` |
| 590 | `className="space-y-6"` on `<aside>` | `className="flex flex-col gap-6"` |
| 602 | `mt-4 space-y-5` | `mt-4 flex flex-col gap-5` |
| 604 | `className="space-y-2"` | `className="flex flex-col gap-2"` |

- [ ] **Step 2: Commit**

```bash
git add src/routes/movie-detail-page.tsx
git commit -m "refactor(movie-detail): replace space-y-* with flex flex-col gap-*"
```

---

### Task 4: Fix `space-y-*` in `search-page.tsx`, `celebrity-page.tsx`, `collection-page.tsx`

**Files:**
- Modify: `src/routes/search-page.tsx`
- Modify: `src/routes/celebrity-page.tsx`
- Modify: `src/routes/collection-page.tsx`

- [ ] **Step 1: Fix search-page.tsx**

Replace `space-y-10` (approx line 478) with `flex flex-col gap-10`.

- [ ] **Step 2: Fix celebrity-page.tsx**

Replace `space-y-3` (approx line 182 in `HeroSkeleton`) with `flex flex-col gap-3`.

- [ ] **Step 3: Fix collection-page.tsx**

Replace `space-y-4` (approx line 14 in `CollectionSkeleton`) with `flex flex-col gap-4`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/search-page.tsx src/routes/celebrity-page.tsx src/routes/collection-page.tsx
git commit -m "refactor: replace space-y-* with flex flex-col gap-* in search, celebrity, collection pages"
```

---

### Task 5: Replace `animate-pulse` divs with `Skeleton` in `book-detail-page.tsx`

**Files:**
- Modify: `src/routes/book-detail-page.tsx`

- [ ] **Step 1: Add Skeleton import**

```tsx
import { Skeleton } from "@/components/ui/skeleton"
```

- [ ] **Step 2: Replace all `animate-pulse` skeleton divs**

For each `<div className="... animate-pulse rounded-... bg-white/70 ..." />` pattern, replace with:

```tsx
<Skeleton className="h-... w-... rounded-..." />
```

Key instances (from the skeleton sub-components throughout the file):
- `<div className="h-full w-full animate-pulse rounded-[20px] bg-white/70" />` → `<Skeleton className="h-full w-full rounded-[20px]" />`
- All skeleton lines in `BookDetailSkeleton`, `HeroSkeleton`, `SidebarSkeleton`, `ContentSkeleton` sub-components
- Remove explicit `bg-white/70` — the Skeleton component provides its own background

Note: Some parent `<div className="animate-pulse">` wrappers may need to be unwrapped if `Skeleton` handles its own pulse animation.

- [ ] **Step 3: Verify skeleton still looks correct in dev**

- [ ] **Step 4: Commit**

```bash
git add src/routes/book-detail-page.tsx
git commit -m "refactor(book-detail): use Skeleton component instead of manual animate-pulse"
```

---

### Task 6: Replace `animate-pulse` divs with `Skeleton` in `movie-detail-page.tsx`

**Files:**
- Modify: `src/routes/movie-detail-page.tsx`

- [ ] **Step 1: Add Skeleton import and replace all `animate-pulse` skeleton divs**

Same pattern as Task 5. Add import and replace all `<div className="... animate-pulse ...">` with `<Skeleton>`.

- [ ] **Step 2: Commit**

```bash
git add src/routes/movie-detail-page.tsx
git commit -m "refactor(movie-detail): use Skeleton component instead of manual animate-pulse"
```

---

### Task 7: Replace `animate-pulse` divs with `Skeleton` in remaining files

**Files:**
- Modify: `src/routes/search-page.tsx`
- Modify: `src/routes/author-page.tsx`
- Modify: `src/routes/celebrity-page.tsx`
- Modify: `src/routes/collection-page.tsx`

- [ ] **Step 1: Add Skeleton import to each file**

- [ ] **Step 2: Replace all `animate-pulse` skeleton patterns in each file**

Each file follows the same pattern: `<div className="animate-pulse ...">` → `<Skeleton className="..." />`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/search-page.tsx src/routes/author-page.tsx src/routes/celebrity-page.tsx src/routes/collection-page.tsx
git commit -m "refactor: use Skeleton component in search, author, celebrity, collection pages"
```

---

### Task 8: Fix template literal ternaries → `cn()`

**Files:**
- Modify: `src/components/expandable-description.tsx`
- Modify: `src/routes/book-detail-page.tsx`
- Modify: `src/routes/movie-detail-page.tsx`

- [ ] **Step 1: Fix expandable-description.tsx**

```tsx
// Before (line ~10):
<div className={`relative ${!expanded && shouldCollapse ? "max-h-[28rem] overflow-hidden" : ""}`}>

// After:
import { cn } from "@/lib/utils"

<div className={cn("relative", !expanded && shouldCollapse && "max-h-[28rem] overflow-hidden")}>
```

- [ ] **Step 2: Fix book-detail-page.tsx skeleton ternary**

```tsx
// Before (line ~527):
className={`h-6 animate-pulse rounded-full bg-white/70 ${index === 7 ? "w-2/3" : "w-full"}`}

// After (will be Skeleton by now from Task 5):
className={cn("h-6 rounded-full", index === 7 ? "w-2/3" : "w-full")}
```

- [ ] **Step 3: Fix movie-detail-page.tsx skeleton ternary**

Same pattern as Step 2, at line ~578.

- [ ] **Step 4: Commit**

```bash
git add src/components/expandable-description.tsx src/routes/book-detail-page.tsx src/routes/movie-detail-page.tsx
git commit -m "refactor: use cn() for conditional classes instead of template literal ternaries"
```

---

### Task 9: Fix raw color `text-amber-500` in `media-card.tsx`

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/media-card.tsx`

- [ ] **Step 1: Add a CSS variable for star/rating color**

In `src/styles.css`, add within the `@theme inline` block:

```css
--color-star: var(--star);
```

And in the base `:root` / `@layer base`:

```css
--star: oklch(0.795 0.184 86.047); /* amber-500 equivalent */
```

- [ ] **Step 2: Replace raw color in media-card.tsx**

```tsx
// Before (line ~51):
<Star className="size-3 fill-current text-amber-500" />

// After:
<Star className="size-3 fill-current text-star" />
```

- [ ] **Step 3: Commit**

```bash
git add src/styles.css src/components/media-card.tsx
git commit -m "refactor(media-card): replace raw text-amber-500 with semantic --color-star token"
```

---

### Task 10: Fix icon in Button — `detail-error-fallback.tsx`

**Files:**
- Modify: `src/components/detail-error-fallback.tsx`

- [ ] **Step 1: Add `data-icon` and remove explicit sizing**

```tsx
// Before (line ~23-25):
<Button variant="outline" onClick={reset}>
  <RotateCw className="size-4" />
  重试
</Button>

// After:
<Button variant="outline" onClick={reset}>
  <RotateCw data-icon="inline-start" />
  重试
</Button>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/detail-error-fallback.tsx
git commit -m "refactor(error-fallback): use data-icon on Button icon per shadcn conventions"
```

---

### Task 11: Fix `h-5 w-5` → `size-5` in `search-page.tsx`

**Files:**
- Modify: `src/routes/search-page.tsx`

- [ ] **Step 1: Replace equal w-/h- with size-**

```tsx
// Before (line ~325):
className="h-5 w-5"

// After:
className="size-5"
```

Also search for any other `w-N h-N` pairs in the file where both values are equal.

- [ ] **Step 2: Commit**

```bash
git add src/routes/search-page.tsx
git commit -m "refactor(search): use size-5 shorthand instead of h-5 w-5"
```

---

### Task 12: Final verification

- [ ] **Step 1: Grep to verify no remaining `space-y-` violations**

```bash
grep -rn "space-y-\|space-x-" src/routes/ src/components/ --include="*.tsx"
```

Expected: no results (or only in `src/components/ui/` generated files)

- [ ] **Step 2: Grep to verify no remaining `animate-pulse` outside ui/**

```bash
grep -rn "animate-pulse" src/routes/ src/components/ --include="*.tsx" | grep -v "src/components/ui/"
```

Expected: no results

- [ ] **Step 3: Grep for remaining template literal className patterns**

```bash
grep -rn 'className={`' src/routes/ src/components/ --include="*.tsx" | grep -v "src/components/ui/"
```

Review any remaining instances and fix if they should use `cn()`.

- [ ] **Step 4: Run dev server and spot-check all pages**

```bash
bun dev
```

Check: search page, book detail, movie detail, author page, celebrity page, collection page — confirm skeletons render correctly and layouts are unchanged.

- [ ] **Step 5: Final commit if any cleanup needed**
