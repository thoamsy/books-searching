# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Package Manager

Use `bun` for all package operations. Never use npm or pnpm.

## Commands

- **Dev**: `bun run dev`
- **Build**: `bun run build` (runs `tsc -b && vite build`)
- **Test**: `bun run test` (vitest) — single file: `bun run test -- src/path/to/file`
- **Deploy**: `bun run build && bunx wrangler deploy` (Cloudflare Worker + Assets to opus.thoamsy.me)

## Architecture

- **Frontend**: React 19 + React Router (lazy routes) + TanStack Query + Tailwind CSS 4 + shadcn/ui
- **Backend**: Cloudflare Worker (`worker/index.ts`) proxies Douban API — the frontend never calls Douban directly
- **Auth**: Supabase Auth (`src/lib/auth-context.tsx`) — requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars
- **OAuth**: Google/GitHub buttons are gated by `VITE_OAUTH_GOOGLE` / `VITE_OAUTH_GITHUB` env vars
- **Styling**: Semantic design tokens defined in `src/styles.css` `@theme inline` block — use `shadow-warm-sm`, `bg-surface`, `text-primary` etc., not `[var(--*)]`

## shadcn/ui Rules

These rules are **mandatory** for all code in this project. Never write code that violates them.

### Spacing

- **No `space-x-*` or `space-y-*`.** Always use `flex gap-*` or `flex flex-col gap-*`.
- **Use `size-*` when width and height are equal.** `size-10` not `w-10 h-10`.
- **Use `truncate` shorthand.** Not `overflow-hidden text-ellipsis whitespace-nowrap`.

### Colors

- **No raw Tailwind colors** (`bg-blue-500`, `text-amber-500`, `text-emerald-600`). Use semantic tokens (`bg-primary`, `text-muted-foreground`, `text-destructive`) or CSS variables (`text-star`).
- **No manual `dark:` color overrides.** Semantic tokens handle light/dark automatically.

### Classes

- **Use `cn()` for conditional classes.** Never use template literal ternaries like `` className={`foo ${cond ? "bar" : ""}`} ``. Always: `className={cn("foo", cond && "bar")}`.
- **No manual `z-index` on overlay components.** Dialog, Sheet, Popover, etc. handle their own stacking.

### Icons

- **Icons in `Button` must use `data-icon`.** `<SearchIcon data-icon="inline-start" />` — no sizing classes (`size-4`, `w-4 h-4`) on icons inside shadcn components.

### Components

- **Use `Skeleton` for loading placeholders.** Never write manual `<div className="animate-pulse ...">` — use `<Skeleton className="h-4 w-full" />`.
- **Use `Separator`** instead of `<hr>` or `<div className="border-t">`.
- **Use `Badge`** instead of custom styled status spans.
- **Use `cn()` from `@/lib/utils`** — it's already available in this project.
