# Home Escape Button Design

## Problem

As the app's link hierarchy grows deeper (up to 3 levels: Search → Detail → Author/Celebrity/Collection → Detail), the single BackButton in DetailLayout is insufficient. Users need a quick escape hatch to return to the home/search page from any depth.

## Design Decision

**Smart split button** — the existing BackButton dynamically "splits" to reveal a Home icon when the user is 2+ levels deep. When shallow (depth < 2), only the familiar back button is shown.

### Why This Approach

- No new UI chrome (no navbar, no FAB) — keeps the current minimal aesthetic
- The Home button appears exactly when needed, with a delightful organic animation
- Leverages existing visual language (frosted glass capsule buttons)

## Depth Tracking

Navigation depth is tracked via React Router's `location.state.navDepth`:

- From search page (/) → depth = 1
- From any detail page → depth = previous depth + 1
- `navDepth >= 2` triggers the Home button appearance

### Implementation

- `useNavDepth()` hook — reads `location.state?.navDepth`, defaults to 1
- `useNavigateWithDepth()` hook — wraps `useNavigate`, auto-injects incremented navDepth into state
- `<DepthLink>` component — wraps `<Link>`, auto-injects incremented navDepth into state
- Existing `state` properties (e.g., `{ book }`, `{ movie }`) are preserved via spread

## Split Animation (Framer Motion)

Uses `LazyMotion` + `domAnimation` feature bundle (~5kB gzipped) for minimal bundle impact. Only imported in the BackButton component.

### Enter Animation (depth transitions from < 2 to >= 2)

1. Back button subtly scales up (`scale: 1.05`, spring `stiffness: 400, damping: 15`) — "charging up"
2. Right border-radius transitions from rounded to flat (CSS transition)
3. A thin divider line (`border-white/30`) grows from center outward (`scaleY: 0 → 1`)
4. Home icon emerges from the right edge: `x: -8 → 0`, `opacity: 0 → 1`, `scale: 0.6 → 1`, `rotate: -10deg → 0deg` (spring physics) — feels like it's "turning to face you"
5. Back button settles back to `scale: 1`, forming a unified capsule button group

### Exit Animation

Reverse of enter — Home icon shrinks back, divider collapses, back button regains full rounded corners.

### Timing & Accessibility

- Total duration: ~350ms
- Non-blocking: buttons are interactive immediately
- `prefers-reduced-motion`: instant show/hide, no animation

## Visual Design

```
Shallow (depth < 2):
  [ ← 返回 ]

Deep (depth >= 2):
  [ ← 返回 │ 🏠 ]
```

- Matches existing button style: `bg-white/65`, `border-white/70`, frosted glass capsule
- Divider: 1px `border-white/30` vertical line
- Home icon: lucide-react `Home`, 16px, same `text-[var(--muted-foreground)]`
- Home hover: icon shifts up 1px (`translateY(-1px)`) for subtle breathing feel

## Files to Create/Modify

### New Files

- `src/hooks/use-nav-depth.ts` — `useNavDepth()` and `useNavigateWithDepth()` hooks
- `src/components/depth-link.tsx` — `<DepthLink>` component wrapping `<Link>` with auto depth injection

### Modified Files

- `src/components/back-button.tsx` — rewrite with split animation logic, LazyMotion
- `src/components/media-card.tsx` — replace `<Link>` with `<DepthLink>`
- `src/routes/search-page.tsx` — replace `navigate()` calls with `useNavigateWithDepth()`
- `src/routes/book-detail-page.tsx` — replace `<Link>` to detail pages with `<DepthLink>`
- `src/routes/movie-detail-page.tsx` — replace `<Link>` to detail pages with `<DepthLink>`
- `src/routes/author-page.tsx` — replace `<Link>`/`<MediaCard>` state with depth-aware version
- `src/routes/collection-page.tsx` — same treatment

### Unchanged

- `src/router.tsx` — DetailLayout stays as-is, BackButton manages itself
- `src/styles.css` — no CSS changes needed (Framer Motion handles animation)
