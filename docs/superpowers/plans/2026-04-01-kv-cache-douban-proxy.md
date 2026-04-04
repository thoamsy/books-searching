# KV Cache for Douban Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use Cloudflare KV to permanently cache detail-type Douban API responses (book, movie, celebrity, credits, works) so all users share a single persistent cache — no redundant upstream fetches.

**Architecture:** The worker already uses `cf.cacheEverything` + `cacheTtl` for edge caching, but that's per-edge-node and evictable. We add a KV layer **before** the upstream fetch: KV hit → return immediately; KV miss → fetch Douban → write to KV (30-day expiry) → return. Search/suggest endpoints stay on the existing short-lived edge cache since they're query-specific and volatile.

**Tech Stack:** Cloudflare Workers KV, wrangler CLI

---

### Task 1: Create KV namespace and bind it

**Files:**
- Modify: `wrangler.toml`

- [ ] **Step 1: Create the KV namespace via wrangler**

```bash
bunx wrangler kv namespace create DOUBAN_CACHE
```

This prints a namespace ID. Copy it.

- [ ] **Step 2: Add the KV binding to wrangler.toml**

Append after the `[assets]` block:

```toml
[[kv_namespaces]]
binding = "DOUBAN_CACHE"
id = "<namespace-id-from-step-1>"
```

- [ ] **Step 3: Commit**

```bash
git add wrangler.toml
git commit -m "chore: add DOUBAN_CACHE KV namespace binding"
```

---

### Task 2: Add KV cache layer to the worker

**Files:**
- Modify: `worker/index.ts`

- [ ] **Step 1: Add KV to the Env interface**

Change:

```typescript
interface Env {
  ASSETS: Fetcher;
}
```

To:

```typescript
interface Env {
  ASSETS: Fetcher;
  DOUBAN_CACHE: KVNamespace;
}
```

- [ ] **Step 2: Add a `cachedProxy` helper function**

Add this function after `proxyRequest`:

```typescript
async function cachedProxy(
  cacheKey: string,
  env: Env,
  request: Request,
  fetchUpstream: () => Promise<Response>,
  ttl = 30 * 86400 // 30 days
): Promise<Response> {
  // 1. Check KV
  const cached = await env.DOUBAN_CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: {
        "Content-Type": "application/json",
        "X-Cache": "HIT",
        ...corsHeaders(request.headers.get("Origin"))
      }
    });
  }

  // 2. Fetch upstream
  const res = await fetchUpstream();

  // 3. Only cache successful JSON responses
  if (res.ok) {
    const body = await res.text();
    // Write to KV in the background (doesn't block response)
    void env.DOUBAN_CACHE.put(cacheKey, body, { expirationTtl: ttl });
    const headers = new Headers(res.headers);
    headers.set("X-Cache", "MISS");
    return new Response(body, { status: res.status, headers });
  }

  return res;
}
```

- [ ] **Step 3: Wire up book detail to use `cachedProxy`**

Change the book detail handler from:

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

To:

```typescript
const bookMatch = url.pathname.match(/^\/api\/douban\/book\/(\d+)\/?$/);
if (bookMatch) {
  const subjectId = bookMatch[1];
  const frodoHeaders = {
    "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
    Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
  };
  return cachedProxy(`book:${subjectId}`, env, request, () =>
    proxyRequest(
      `https://frodo.douban.com/api/v2/book/${subjectId}?apikey=0ac44ae016490db2204ce0a042db2916`,
      request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
    )
  );
}
```

- [ ] **Step 4: Wire up movie detail to use `cachedProxy`**

Change the movie detail handler from:

```typescript
const movieMatch = url.pathname.match(/^\/api\/douban\/movie\/(\d+)\/?$/);
if (movieMatch) {
  const subjectId = movieMatch[1];
  const frodoHeaders = { ... };
  const movieRes = await proxyRequest(
    `https://frodo.douban.com/api/v2/movie/${subjectId}?apikey=0ac44ae016490db2204ce0a042db2916`,
    request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
  );
  if (movieRes.status === 400 || movieRes.status === 404) {
    return proxyRequest(
      `https://frodo.douban.com/api/v2/tv/${subjectId}?apikey=0ac44ae016490db2204ce0a042db2916`,
      request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
    );
  }
  return movieRes;
}
```

To:

```typescript
const movieMatch = url.pathname.match(/^\/api\/douban\/movie\/(\d+)\/?$/);
if (movieMatch) {
  const subjectId = movieMatch[1];
  const frodoHeaders = {
    "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
    Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
  };
  return cachedProxy(`movie:${subjectId}`, env, request, async () => {
    const movieRes = await proxyRequest(
      `https://frodo.douban.com/api/v2/movie/${subjectId}?apikey=0ac44ae016490db2204ce0a042db2916`,
      request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
    );
    if (movieRes.status === 400 || movieRes.status === 404) {
      return proxyRequest(
        `https://frodo.douban.com/api/v2/tv/${subjectId}?apikey=0ac44ae016490db2204ce0a042db2916`,
        request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
      );
    }
    return movieRes;
  });
}
```

- [ ] **Step 5: Wire up movie credits to use `cachedProxy`**

Change the credits handler from:

```typescript
const movieCreditsMatch = url.pathname.match(/^\/api\/douban\/movie\/(\d+)\/credits\/?$/);
if (movieCreditsMatch) {
  const subjectId = movieCreditsMatch[1];
  const frodoHeaders = { ... };
  return proxyRequest(
    `https://frodo.douban.com/api/v2/movie/${subjectId}/credits?apikey=0ac44ae016490db2204ce0a042db2916&count=50`,
    request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
  );
}
```

To:

```typescript
const movieCreditsMatch = url.pathname.match(/^\/api\/douban\/movie\/(\d+)\/credits\/?$/);
if (movieCreditsMatch) {
  const subjectId = movieCreditsMatch[1];
  const frodoHeaders = {
    "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
    Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
  };
  return cachedProxy(`movie-credits:${subjectId}`, env, request, () =>
    proxyRequest(
      `https://frodo.douban.com/api/v2/movie/${subjectId}/credits?apikey=0ac44ae016490db2204ce0a042db2916&count=50`,
      request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
    )
  );
}
```

- [ ] **Step 6: Wire up celebrity detail to use `cachedProxy`**

Change the celebrity handler from:

```typescript
const celebrityMatch = url.pathname.match(/^\/api\/douban\/celebrity\/(\d+)\/?$/);
if (celebrityMatch) {
  const celebrityId = celebrityMatch[1];
  const frodoHeaders = { ... };
  return proxyRequest(
    `https://frodo.douban.com/api/v2/celebrity/${celebrityId}?apikey=0ac44ae016490db2204ce0a042db2916`,
    request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
  );
}
```

To:

```typescript
const celebrityMatch = url.pathname.match(/^\/api\/douban\/celebrity\/(\d+)\/?$/);
if (celebrityMatch) {
  const celebrityId = celebrityMatch[1];
  const frodoHeaders = {
    "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
    Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
  };
  return cachedProxy(`celebrity:${celebrityId}`, env, request, () =>
    proxyRequest(
      `https://frodo.douban.com/api/v2/celebrity/${celebrityId}?apikey=0ac44ae016490db2204ce0a042db2916`,
      request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
    )
  );
}
```

- [ ] **Step 7: Wire up celebrity works to use `cachedProxy`**

Celebrity works is paginated (`start`, `count`), so include those in the cache key.

Change the celebrity works handler from:

```typescript
const celebrityWorksMatch = url.pathname.match(/^\/api\/douban\/celebrity\/(\d+)\/works\/?$/);
if (celebrityWorksMatch) {
  const celebrityId = celebrityWorksMatch[1];
  const frodoHeaders = { ... };
  const start = url.searchParams.get("start") ?? "0";
  const count = url.searchParams.get("count") ?? "50";
  return proxyRequest(
    `https://frodo.douban.com/api/v2/celebrity/${celebrityId}/works?apikey=0ac44ae016490db2204ce0a042db2916&start=${start}&count=${count}`,
    request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
  );
}
```

To:

```typescript
const celebrityWorksMatch = url.pathname.match(/^\/api\/douban\/celebrity\/(\d+)\/works\/?$/);
if (celebrityWorksMatch) {
  const celebrityId = celebrityWorksMatch[1];
  const frodoHeaders = {
    "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
    Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
  };
  const start = url.searchParams.get("start") ?? "0";
  const count = url.searchParams.get("count") ?? "50";
  return cachedProxy(`celebrity-works:${celebrityId}:${start}:${count}`, env, request, () =>
    proxyRequest(
      `https://frodo.douban.com/api/v2/celebrity/${celebrityId}/works?apikey=0ac44ae016490db2204ce0a042db2916&start=${start}&count=${count}`,
      request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
    )
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add worker/index.ts
git commit -m "feat(worker): add KV cache layer for detail endpoints"
```

---

### Task 3: Deploy and verify

- [ ] **Step 1: Build frontend**

```bash
bun run build
```

- [ ] **Step 2: Deploy to Cloudflare**

```bash
bunx wrangler deploy
```

- [ ] **Step 3: Verify cache MISS then HIT**

First request (MISS — fetches from Douban and writes to KV):
```bash
curl -s -D - 'https://opus.thoamsy.me/api/douban/book/1084336' | head -20
```
Check for `X-Cache: MISS` header.

Second request (HIT — served from KV):
```bash
curl -s -D - 'https://opus.thoamsy.me/api/douban/book/1084336' | head -20
```
Check for `X-Cache: HIT` header.

- [ ] **Step 4: Commit and tag**

```bash
git add -A
git commit -m "chore: deploy with KV cache"
```

---

## Endpoints NOT cached in KV (intentional)

| Endpoint | Reason |
|----------|--------|
| `/api/douban/suggest` | Query-specific, high cardinality, short-lived — edge cache is sufficient |
| `/api/douban/search` | Same as above |
| `/api/douban/movie/suggest` | Same as above |
| `/api/douban/movie/search` | Same as above |
| `/api/douban/collection/*` | Collection content changes frequently (rankings, new additions) |
| `/api/douban/image` | Already cached 7 days at edge; binary blobs in KV would waste storage |
