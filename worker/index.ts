interface Env {
  ASSETS: Fetcher;
  DOUBAN_CACHE: KVNamespace;
}

const MAX_PAGINATION_COUNT = 50;
const MAX_PAGINATION_START = 1000;
const ALLOWED_IMAGE_HOST_SUFFIXES = ["doubanio.com"];
const IMAGE_EDGE_TTL = 30 * 86400;
const IMAGE_BROWSER_TTL = 30 * 86400;
const IMAGE_CACHE_CONTROL = `public, max-age=${IMAGE_BROWSER_TTL}, immutable`;

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Referer: "https://www.douban.com/",
  Cookie: "bid=JKl8gT2Nxfw"
};

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin"
  };
}

function resolveCorsOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return null;
  }

  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    const isLocalDevOrigin = originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1";
    if (originUrl.origin === requestUrl.origin || isLocalDevOrigin) {
      return originUrl.origin;
    }
  } catch {
    return null;
  }

  return request.url ? new URL(request.url).origin : null;
}

function jsonError(message: string, status: number, origin: string | null) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin)
    }
  });
}

function normalizePagination(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return String(fallback);
  }

  return String(Math.min(parsed, max));
}

function parseImageSource(source: string) {
  try {
    const url = new URL(source);
    const isAllowedHost = ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`));
    if (url.protocol !== "https:" || !isAllowedHost) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function extractImageSource(url: URL) {
  const mediaPrefix = "/media/douban/";
  if (!url.pathname.startsWith(mediaPrefix)) {
    return null;
  }

  const encodedSource = url.pathname.slice(mediaPrefix.length);
  if (!encodedSource) {
    return "";
  }

  try {
    return decodeURIComponent(encodedSource);
  } catch {
    return "";
  }
}

function imageCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function matchesConditionalHeader(headerValue: string | null, candidate: string) {
  if (!headerValue) {
    return false;
  }

  return headerValue
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === "*" || value === candidate);
}

async function createWeakEtag(parts: string[]) {
  const payload = new TextEncoder().encode(parts.join("|"));
  const digest = await crypto.subtle.digest("SHA-256", payload);
  const hash = Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

  return `W/"${hash}"`;
}

async function proxyImageRequest(target: string, request: Request) {
  const origin = resolveCorsOrigin(request);
  const upstream = await fetch(target, {
    headers: DEFAULT_HEADERS,
    redirect: "follow",
    cf: {
      cacheEverything: true,
      cacheTtl: IMAGE_EDGE_TTL
    }
  });

  if (upstream.url?.includes("sec.douban.com")) {
    return new Response(JSON.stringify({ error: "rate-limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
    });
  }

  const headers = new Headers(upstream.headers);
  Object.entries(imageCorsHeaders()).forEach(([key, value]) => headers.set(key, value));
  headers.set("Cache-Control", IMAGE_CACHE_CONTROL);

  const etag = headers.get("ETag") ?? await createWeakEtag([
    target,
    headers.get("Last-Modified") ?? "",
    headers.get("Content-Length") ?? "",
    headers.get("Content-Type") ?? ""
  ]);
  headers.set("ETag", etag);

  if (matchesConditionalHeader(request.headers.get("If-None-Match"), etag)) {
    headers.delete("Content-Length");
    return new Response(null, {
      status: 304,
      headers
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}

const FRODO_HEADERS = {
  "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
  Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
};

const FRODO_APIKEY = "0ac44ae016490db2204ce0a042db2916";

const REXXAR_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  Referer: "https://m.douban.com/"
};

// ── OG meta helpers ──────────────────────────────────────────────

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}

interface OGMeta {
  title: string;
  description: string;
  image: string;
  type: string;
}

async function fetchBookOG(
  id: string,
  origin: string,
  env: Env,
  ctx: ExecutionContext
): Promise<OGMeta | null> {
  try {
    let json = await env.DOUBAN_CACHE.get(`book:${id}`);
    if (!json) {
      const res = await fetch(
        `https://frodo.douban.com/api/v2/book/${id}?apikey=${FRODO_APIKEY}`,
        { headers: { ...DEFAULT_HEADERS, ...FRODO_HEADERS } }
      );
      if (!res.ok) return null;
      json = await res.text();
      ctx.waitUntil(
        env.DOUBAN_CACHE.put(`book:${id}`, json, { expirationTtl: 30 * 86400 })
      );
    }

    const data = JSON.parse(json);
    const title = data.title || "未知书名";
    const authors = (data.author ?? []).slice(0, 3).join(" / ");
    const coverUrl: string | undefined = data.pic?.large ?? data.cover_url;

    return {
      title: authors ? `${title} — ${authors}` : title,
      description: truncate((data.intro ?? "").replace(/\n+/g, " "), 200),
      image: coverUrl
        ? `${origin}/api/douban/image?url=${encodeURIComponent(coverUrl)}`
        : "",
      type: "book",
    };
  } catch {
    return null;
  }
}

async function fetchMovieOG(
  id: string,
  origin: string,
  env: Env,
  ctx: ExecutionContext
): Promise<OGMeta | null> {
  try {
    let json = await env.DOUBAN_CACHE.get(`movie:${id}`);
    if (!json) {
      let res = await fetch(
        `https://frodo.douban.com/api/v2/movie/${id}?apikey=${FRODO_APIKEY}`,
        { headers: { ...DEFAULT_HEADERS, ...FRODO_HEADERS } }
      );
      if (res.status === 400 || res.status === 404) {
        res = await fetch(
          `https://frodo.douban.com/api/v2/tv/${id}?apikey=${FRODO_APIKEY}`,
          { headers: { ...DEFAULT_HEADERS, ...FRODO_HEADERS } }
        );
      }
      if (!res.ok) return null;
      json = await res.text();
      ctx.waitUntil(
        env.DOUBAN_CACHE.put(`movie:${id}`, json, { expirationTtl: 30 * 86400 })
      );
    }

    const data = JSON.parse(json);
    const title = data.title || "未知影片";
    const year: string | undefined = data.year;
    const coverUrl: string | undefined =
      data.cover?.image?.large?.url ?? data.pic?.large ?? data.cover_url;

    return {
      title: year ? `${title} (${year})` : title,
      description: truncate((data.intro ?? "").replace(/\n+/g, " "), 200),
      image: coverUrl
        ? `${origin}/api/douban/image?url=${encodeURIComponent(coverUrl)}`
        : "",
      type: "video.movie",
    };
  } catch {
    return null;
  }
}

function injectOGTags(
  assetResponse: Response,
  og: OGMeta,
  canonicalUrl: string
): Response {
  return new HTMLRewriter()
    .on("title", {
      element(el) {
        el.setInnerContent(`${og.title} — Opus`);
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute("content", og.description);
      },
    })
    .on("head", {
      element(el) {
        el.append(
          [
            `<meta property="og:title" content="${escapeAttr(og.title)}" />`,
            `<meta property="og:description" content="${escapeAttr(og.description)}" />`,
            `<meta property="og:image" content="${escapeAttr(og.image)}" />`,
            `<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`,
            `<meta property="og:type" content="${og.type}" />`,
            `<meta property="og:site_name" content="Opus" />`,
            `<meta name="twitter:card" content="summary_large_image" />`,
            `<meta name="twitter:title" content="${escapeAttr(og.title)}" />`,
            `<meta name="twitter:description" content="${escapeAttr(og.description)}" />`,
            `<meta name="twitter:image" content="${escapeAttr(og.image)}" />`,
          ].join("\n"),
          { html: true }
        );
      },
    })
    .transform(assetResponse);
}

// ── End OG meta helpers ──────────────────────────────────────────

async function proxyRequest(
  target: string,
  request: Request,
  options?: {
    extraHeaders?: Record<string, string>;
    cacheTtl?: number;
    maxAge?: number;
    immutable?: boolean;
  }
) {
  const origin = resolveCorsOrigin(request);
  const upstream = await fetch(target, {
    headers: {
      ...DEFAULT_HEADERS,
      ...options?.extraHeaders
    },
    redirect: "follow",
    cf: {
      cacheEverything: true,
      cacheTtl: options?.cacheTtl ?? 300
    }
  });

  // Douban may redirect to sec.douban.com for security challenges
  if (upstream.url?.includes("sec.douban.com")) {
    return new Response(JSON.stringify({ error: "rate-limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
    });
  }

  const headers = new Headers(upstream.headers);
  Object.entries(corsHeaders(origin)).forEach(([key, value]) => headers.set(key, value));
  headers.set(
    "Cache-Control",
    `public, max-age=${options?.maxAge ?? 300}${options?.immutable ? ", immutable" : ""}`
  );

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}

async function cachedProxy(
  cacheKey: string,
  env: Env,
  ctx: ExecutionContext,
  request: Request,
  fetchUpstream: () => Promise<Response>,
  ttl = 30 * 86400 // 30 days
): Promise<Response> {
  const origin = resolveCorsOrigin(request);
  // 1. Check KV
  const cached = await env.DOUBAN_CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
        "X-Cache": "HIT",
        ...corsHeaders(origin)
      }
    });
  }

  // 2. Fetch upstream
  const res = await fetchUpstream();

  // 3. Only cache successful JSON responses
  if (res.ok) {
    const body = await res.text();
    ctx.waitUntil(env.DOUBAN_CACHE.put(cacheKey, body, { expirationTtl: ttl }));
    const headers = new Headers(res.headers);
    headers.set("X-Cache", "MISS");
    return new Response(body, { status: res.status, headers });
  }

  return res;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const origin = resolveCorsOrigin(request);

    try {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(origin)
        });
      }

      if (url.pathname === "/api/douban/suggest") {
        const query = url.searchParams.get("q") ?? "";
        const target = new URL("https://book.douban.com/j/subject_suggest");
        target.searchParams.set("q", query);
        return proxyRequest(target.toString(), request, { extraHeaders: { Referer: "https://book.douban.com/" } });
      }

      if (url.pathname === "/api/douban/movie/suggest") {
        const query = url.searchParams.get("q") ?? "";
        const target = new URL("https://movie.douban.com/j/subject_suggest");
        target.searchParams.set("q", query);
        return proxyRequest(target.toString(), request, { extraHeaders: { Referer: "https://movie.douban.com/" } });
      }

      if (url.pathname === "/api/douban/search/subjects") {
        const query = url.searchParams.get("q") ?? "";
        const type = url.searchParams.get("type") ?? "";
        const start = normalizePagination(url.searchParams.get("start"), 0, MAX_PAGINATION_START);
        const count = normalizePagination(url.searchParams.get("count"), 20, MAX_PAGINATION_COUNT);
        const target = new URL("https://frodo.douban.com/api/v2/search/subjects");
        target.searchParams.set("q", query);
        if (type) target.searchParams.set("type", type);
        target.searchParams.set("start", start);
        target.searchParams.set("count", count);
        target.searchParams.set("apikey", FRODO_APIKEY);
        return proxyRequest(target.toString(), request, {
          cacheTtl: 1800,
          extraHeaders: FRODO_HEADERS
        });
      }

      const bookMatch = url.pathname.match(/^\/api\/douban\/book\/(\d+)\/?$/);
      if (bookMatch) {
        const subjectId = bookMatch[1];
        return cachedProxy(`book:${subjectId}`, env, ctx, request, () =>
          proxyRequest(
            `https://frodo.douban.com/api/v2/book/${subjectId}?apikey=${FRODO_APIKEY}`,
            request, { cacheTtl: 86400, extraHeaders: FRODO_HEADERS }
          )
        );
      }

      const celebrityWorksMatch = url.pathname.match(/^\/api\/douban\/celebrity\/(\d+)\/works\/?$/);
      if (celebrityWorksMatch) {
        const celebrityId = celebrityWorksMatch[1];
        const start = normalizePagination(url.searchParams.get("start"), 0, MAX_PAGINATION_START);
        const count = normalizePagination(url.searchParams.get("count"), 50, MAX_PAGINATION_COUNT);
        return cachedProxy(`celebrity-works:${celebrityId}:${start}:${count}`, env, ctx, request, () =>
          proxyRequest(
            `https://frodo.douban.com/api/v2/celebrity/${celebrityId}/works?apikey=${FRODO_APIKEY}&start=${start}&count=${count}`,
            request, { cacheTtl: 86400, extraHeaders: FRODO_HEADERS }
          )
        );
      }

      const celebrityMatch = url.pathname.match(/^\/api\/douban\/celebrity\/(\d+)\/?$/);
      if (celebrityMatch) {
        const celebrityId = celebrityMatch[1];
        return cachedProxy(`celebrity:${celebrityId}`, env, ctx, request, () =>
          proxyRequest(
            `https://frodo.douban.com/api/v2/celebrity/${celebrityId}?apikey=${FRODO_APIKEY}`,
            request, { cacheTtl: 86400, extraHeaders: FRODO_HEADERS }
          )
        );
      }

      const movieCreditsMatch = url.pathname.match(/^\/api\/douban\/movie\/(\d+)\/credits\/?$/);
      if (movieCreditsMatch) {
        const subjectId = movieCreditsMatch[1];
        return cachedProxy(`movie-credits:${subjectId}`, env, ctx, request, () =>
          proxyRequest(
            `https://frodo.douban.com/api/v2/movie/${subjectId}/credits?apikey=${FRODO_APIKEY}&count=50`,
            request, { cacheTtl: 86400, extraHeaders: FRODO_HEADERS }
          )
        );
      }

      const movieMatch = url.pathname.match(/^\/api\/douban\/movie\/(\d+)\/?$/);
      if (movieMatch) {
        const subjectId = movieMatch[1];
        return cachedProxy(`movie:${subjectId}`, env, ctx, request, async () => {
          const movieRes = await proxyRequest(
            `https://frodo.douban.com/api/v2/movie/${subjectId}?apikey=${FRODO_APIKEY}`,
            request, { cacheTtl: 86400, extraHeaders: FRODO_HEADERS }
          );
          if (movieRes.status === 400 || movieRes.status === 404) {
            return proxyRequest(
              `https://frodo.douban.com/api/v2/tv/${subjectId}?apikey=${FRODO_APIKEY}`,
              request, { cacheTtl: 86400, extraHeaders: FRODO_HEADERS }
            );
          }
          return movieRes;
        });
      }

      const collectionItemsMatch = url.pathname.match(/^\/api\/douban\/collection\/([A-Za-z0-9_]+)\/items\/?$/);
      if (collectionItemsMatch) {
        const collectionId = collectionItemsMatch[1];
        const start = normalizePagination(url.searchParams.get("start"), 0, MAX_PAGINATION_START);
        const count = normalizePagination(url.searchParams.get("count"), 20, MAX_PAGINATION_COUNT);
        return proxyRequest(
          `https://m.douban.com/rexxar/api/v2/subject_collection/${collectionId}/items?start=${start}&count=${count}`,
          request, { cacheTtl: 300, extraHeaders: REXXAR_HEADERS }
        );
      }

      const collectionMetaMatch = url.pathname.match(/^\/api\/douban\/collection\/([A-Za-z0-9_]+)\/?$/);
      if (collectionMetaMatch) {
        const collectionId = collectionMetaMatch[1];
        return cachedProxy(`collection:${collectionId}`, env, ctx, request, () =>
          proxyRequest(
            `https://m.douban.com/rexxar/api/v2/subject_collection/${collectionId}`,
            request, { cacheTtl: 300, extraHeaders: REXXAR_HEADERS }
          )
        );
      }

      const imageSource = extractImageSource(url);
      if (imageSource !== null) {
        if (!imageSource) {
          return jsonError("missing-image-url", 400, origin);
        }

        const imageUrl = parseImageSource(imageSource);
        if (!imageUrl) {
          return jsonError("invalid-image-url", 400, origin);
        }

        return proxyImageRequest(imageUrl, request);
      }

      // OG meta injection for detail pages
      const bookPageMatch = url.pathname.match(/^\/book\/(\d+)\/?$/);
      const moviePageMatch =
        !bookPageMatch && url.pathname.match(/^\/movie\/(\d+)\/?$/);

      if (bookPageMatch || moviePageMatch) {
        const id = (bookPageMatch ?? moviePageMatch)![1];
        const fetchOG = bookPageMatch
          ? fetchBookOG(id, url.origin, env, ctx)
          : fetchMovieOG(id, url.origin, env, ctx);

        const [og, assetResponse] = await Promise.all([
          fetchOG,
          env.ASSETS.fetch(request),
        ]);

        if (og && assetResponse.ok) {
          return injectOGTags(
            assetResponse,
            og,
            `${url.origin}${url.pathname}`
          );
        }

        return assetResponse;
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("worker fetch failed", error);
      return jsonError("upstream-fetch-failed", 502, origin);
    }
  }
};
