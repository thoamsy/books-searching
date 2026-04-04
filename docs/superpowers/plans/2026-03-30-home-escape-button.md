# Home Escape Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a smart Home escape button that "splits" from the BackButton when navigation depth >= 2, with a delightful spring animation.

**Architecture:** Navigation depth tracked via `location.state.navDepth`. A `useNavDepth` hook reads it, a `DepthLink` component and `useNavigateWithDepth` hook auto-inject it. The BackButton uses `LazyMotion` + `domAnimation` from framer-motion for a split/merge animation.

**Tech Stack:** React Router DOM v7, framer-motion (LazyMotion + domAnimation), lucide-react, Tailwind CSS v4

---

### Task 1: Install framer-motion

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install framer-motion**

```bash
bun add framer-motion
```

- [ ] **Step 2: Verify installation**

```bash
bun run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add framer-motion dependency"
```

---

### Task 2: Create useNavDepth hook

**Files:**
- Create: `src/hooks/use-nav-depth.ts`

- [ ] **Step 1: Create the hook file**

```ts
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { NavigateOptions, To } from "react-router-dom";

/**
 * Read the current navigation depth from location state.
 * Depth starts at 1 when navigating from search page into a detail page.
 */
export function useNavDepth(): number {
  const location = useLocation();
  const state = location.state as { navDepth?: number } | null;
  return state?.navDepth ?? 1;
}

/**
 * Returns a navigate function that auto-increments navDepth in state.
 * Preserves any existing state properties (e.g. { book }, { movie }).
 */
export function useNavigateWithDepth() {
  const navigate = useNavigate();
  const currentDepth = useNavDepth();

  return useCallback(
    (to: To, options?: NavigateOptions) => {
      const existingState =
        (options?.state as Record<string, unknown> | null) ?? {};
      navigate(to, {
        ...options,
        state: { ...existingState, navDepth: currentDepth + 1 },
      });
    },
    [navigate, currentDepth],
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-nav-depth.ts
git commit -m "feat: add useNavDepth and useNavigateWithDepth hooks"
```

---

### Task 3: Create DepthLink component

**Files:**
- Create: `src/components/depth-link.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Link } from "react-router-dom";
import { useNavDepth } from "@/hooks/use-nav-depth";
import type { ComponentProps } from "react";

type DepthLinkProps = ComponentProps<typeof Link>;

/**
 * A Link that auto-injects navDepth into location state.
 * Preserves any existing state passed via the `state` prop.
 */
export function DepthLink({ state, ...props }: DepthLinkProps) {
  const currentDepth = useNavDepth();
  const existingState = (state as Record<string, unknown> | null) ?? {};

  return (
    <Link
      {...props}
      state={{ ...existingState, navDepth: currentDepth + 1 }}
    />
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/depth-link.tsx
git commit -m "feat: add DepthLink component for auto depth tracking"
```

---

### Task 4: Rewrite BackButton with split animation

**Files:**
- Modify: `src/components/back-button.tsx`

- [ ] **Step 1: Rewrite BackButton with framer-motion split animation**

Replace the entire content of `src/components/back-button.tsx` with:

```tsx
import { useCallback } from "react";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import { ArrowLeft, Home } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNavDepth } from "@/hooks/use-nav-depth";

const springConfig = { stiffness: 400, damping: 22, mass: 0.8 };

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const depth = useNavDepth();
  const showHome = depth >= 2;

  const handleBack = useCallback(() => {
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/");
    }
  }, [location.key, navigate]);

  const handleHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className="inline-flex items-center overflow-hidden rounded-full border border-white/70 bg-white/65"
        layout
        transition={{ layout: springConfig }}
      >
        {/* Back button (always visible) */}
        <m.button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          layout
          transition={{ layout: springConfig }}
        >
          <ArrowLeft className="size-4" />
          返回
        </m.button>

        {/* Divider + Home button (conditional) */}
        <AnimatePresence>
          {showHome && (
            <m.div
              className="flex items-center"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={springConfig}
            >
              {/* Divider line */}
              <m.div
                className="h-4 w-px bg-white/40"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                exit={{ scaleY: 0 }}
                transition={{ ...springConfig, delay: 0.05 }}
              />

              {/* Home button */}
              <m.button
                type="button"
                onClick={handleHome}
                className="inline-flex items-center px-3 py-2 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                initial={{ opacity: 0, scale: 0.6, x: -8, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.6, x: -8, rotate: -10 }}
                transition={springConfig}
              >
                <Home className="size-4 transition-transform hover:-translate-y-px" />
              </m.button>
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    </LazyMotion>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Manual test — visit a detail page directly**

Open the app, navigate to any detail page directly (e.g. `/book/OL123W`). Only "← 返回" should show.

- [ ] **Step 4: Commit**

```bash
git add src/components/back-button.tsx
git commit -m "feat: rewrite BackButton with split Home animation using LazyMotion"
```

---

### Task 5: Wire depth into search-page navigate() calls

**Files:**
- Modify: `src/routes/search-page.tsx`

The search page is the root — all navigations from here set `navDepth: 1`.

- [ ] **Step 1: Add import**

At the top of `src/routes/search-page.tsx`, add after the existing `react-router-dom` import line:

```ts
import { useNavigateWithDepth } from "@/hooks/use-nav-depth";
```

- [ ] **Step 2: Replace the navigate hook**

Find the line where `useNavigate` is called (inside the main component function) and replace:

```ts
const navigate = useNavigate();
```

with:

```ts
const navigate = useNavigateWithDepth();
```

Then remove `useNavigate` from the `react-router-dom` import if it's no longer used (check that `useLocation` is still imported if used elsewhere in the file).

- [ ] **Step 3: Verify it compiles and test**

```bash
bun run build
```

Expected: Build succeeds. From the search page, navigating to a book/movie/author/celebrity detail page should result in `navDepth: 1` in location state — only "← 返回" button visible (no Home icon).

- [ ] **Step 4: Commit**

```bash
git add src/routes/search-page.tsx
git commit -m "feat: wire navDepth into search-page navigate calls"
```

---

### Task 6: Wire depth into book-detail-page Links

**Files:**
- Modify: `src/routes/book-detail-page.tsx`

This page has `<Link>` elements pointing to `/author/:name` and `/collection/:id`. These need to become `<DepthLink>`.

- [ ] **Step 1: Add import**

Add at the top of `src/routes/book-detail-page.tsx`:

```ts
import { DepthLink } from "@/components/depth-link";
```

- [ ] **Step 2: Replace detail-page Links with DepthLink**

Replace every `<Link` that navigates to `/author/...` or `/collection/...` with `<DepthLink`. There are approximately 5 occurrences:

- Line ~199: `<Link ... to={`/author/${encodeURIComponent(author)}`}` → `<DepthLink`
- Line ~242: `<Link key={honor.title} to={`/collection/${honor.collectionId}`}>` → `<DepthLink`
- Line ~305: `<Link key={c.id} to={`/collection/${c.id}`}>` → `<DepthLink`
- Line ~374: `<Link ... to={`/author/${encodeURIComponent(author)}`}` → `<DepthLink`
- Line ~417: `<Link key={honor.title} to={`/collection/${honor.collectionId}`}>` → `<DepthLink`

Do NOT replace `<Link to="/">` (the "返回搜索" fallback) — those go to home, no depth needed.

Remove `Link` from the `react-router-dom` import if it's no longer used there (keep `useLocation`, `useParams`).

- [ ] **Step 3: Verify it compiles**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/routes/book-detail-page.tsx
git commit -m "feat: use DepthLink for book detail page navigation"
```

---

### Task 7: Wire depth into movie-detail-page Links

**Files:**
- Modify: `src/routes/movie-detail-page.tsx`

Same pattern as book-detail. Has `<Link>` elements pointing to `/celebrity/:id`, `/collection/:id`.

- [ ] **Step 1: Add import**

```ts
import { DepthLink } from "@/components/depth-link";
```

- [ ] **Step 2: Replace detail-page Links with DepthLink**

Replace every `<Link` navigating to `/celebrity/...` or `/collection/...`:

- Line ~212: `<Link ... to={person.id ? `/celebrity/${person.id}` : ...}` → `<DepthLink`
- Line ~230: same pattern → `<DepthLink`
- Line ~278: `<Link key={honor.title} to={`/collection/${honor.collectionId}`}>` → `<DepthLink`
- Line ~378: `<Link key={c.id} to={`/collection/${c.id}`}>` → `<DepthLink`
- Line ~421: same celebrity pattern → `<DepthLink`
- Line ~439: same celebrity pattern → `<DepthLink`
- Line ~474: `<Link key={honor.title} to={`/collection/${honor.collectionId}`}>` → `<DepthLink`

Do NOT replace `<Link to="/">` (the "返回搜索" fallback).

Remove `Link` from `react-router-dom` import if no longer used.

- [ ] **Step 3: Verify it compiles**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/routes/movie-detail-page.tsx
git commit -m "feat: use DepthLink for movie detail page navigation"
```

---

### Task 8: Wire depth into MediaCard (affects author-page, collection-page, celebrity-page)

**Files:**
- Modify: `src/components/media-card.tsx`

MediaCard is used by author-page, collection-page, and celebrity-page. Replacing the `<Link>` inside MediaCard with `<DepthLink>` covers all three pages at once.

- [ ] **Step 1: Replace Link with DepthLink in MediaCard**

In `src/components/media-card.tsx`, replace:

```ts
import { Link } from "react-router-dom";
```

with:

```ts
import { DepthLink } from "@/components/depth-link";
```

Then replace the `<Link` usage on line 26:

```tsx
<Link to={to} state={state} className="group flex flex-col gap-2.5">
```

with:

```tsx
<DepthLink to={to} state={state} className="group flex flex-col gap-2.5">
```

And the closing `</Link>` (line 57) with `</DepthLink>`.

- [ ] **Step 2: Verify it compiles**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/media-card.tsx
git commit -m "feat: use DepthLink in MediaCard for automatic depth tracking"
```

---

### Task 9: End-to-end manual testing

**Files:** None (testing only)

- [ ] **Step 1: Start dev server**

```bash
bun run dev
```

- [ ] **Step 2: Test shallow navigation**

1. From search page, search for a book and click into it.
2. Verify only "← 返回" button shows (no Home icon).
3. Click "← 返回" — should go back to search page.

- [ ] **Step 3: Test deep navigation (depth >= 2)**

1. From search page, click into a book detail.
2. Click an author pill to go to the author page.
3. Verify the BackButton now shows "← 返回 │ 🏠" with the split animation.
4. Click the Home icon — should navigate directly to `/` (search page).

- [ ] **Step 4: Test deep navigation via collections**

1. From search page, click into a movie detail.
2. Click a collection/honor badge.
3. Verify "← 返回 │ 🏠" appears with animation.
4. From collection page, click into another movie.
5. Verify Home button is still visible (depth >= 2).
6. Click Home — back to search page.

- [ ] **Step 5: Test exit animation**

1. Navigate deep (2+ levels).
2. Click "← 返回" to go back one level.
3. If you're back at depth 1, verify the Home icon smoothly merges back into the back button.

- [ ] **Step 6: Test direct URL entry**

1. Navigate directly to a detail page via URL (e.g. paste `/book/OL123W`).
2. Verify only "← 返回" shows (depth defaults to 1).
3. Click "← 返回" — should go to `/` since there's no browser history.

- [ ] **Step 7: Test prefers-reduced-motion**

1. Enable "Reduce motion" in system settings.
2. Repeat deep navigation — Home button should appear/disappear instantly without animation.

- [ ] **Step 8: Commit final state if any tweaks were needed**

```bash
git add -u
git commit -m "fix: polish home button animation after manual testing"
```

Only commit if changes were made during testing.
