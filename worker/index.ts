interface Env {
  ASSETS: Fetcher;
  DOUBAN_CACHE: KVNamespace;
}

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
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

async function proxyRequest(target: string, request: Request, options?: { extraHeaders?: Record<string, string>; cacheTtl?: number }) {
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
      headers: { "Content-Type": "application/json", ...corsHeaders(request.headers.get("Origin")) }
    });
  }

  const headers = new Headers(upstream.headers);
  const origin = request.headers.get("Origin");
  Object.entries(corsHeaders(origin)).forEach(([key, value]) => headers.set(key, value));
  headers.set("Cache-Control", "public, max-age=300");

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
  // 1. Check KV
  const cached = await env.DOUBAN_CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
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
    ctx.waitUntil(env.DOUBAN_CACHE.put(cacheKey, body, { expirationTtl: ttl }));
    const headers = new Headers(res.headers);
    headers.set("X-Cache", "MISS");
    return new Response(body, { status: res.status, headers });
  }

  return res;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request.headers.get("Origin"))
      });
    }

    if (url.pathname === "/api/douban/suggest") {
      const query = url.searchParams.get("q") ?? "";
      const target = new URL("https://book.douban.com/j/subject_suggest");
      target.searchParams.set("q", query);
      return proxyRequest(target.toString(), request, { extraHeaders: { Referer: "https://book.douban.com/" } });
    }

    if (url.pathname === "/api/douban/search") {
      const query = url.searchParams.get("q") ?? "";
      const target = new URL("https://www.douban.com/search");
      target.searchParams.set("cat", "1001");
      target.searchParams.set("q", query);
      return proxyRequest(target.toString(), request, { cacheTtl: 1800 });
    }

    const bookMatch = url.pathname.match(/^\/api\/douban\/book\/(\d+)\/?$/);
    if (bookMatch) {
      const subjectId = bookMatch[1];
      const frodoHeaders = {
        "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
        Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
      };
      return cachedProxy(`book:${subjectId}`, env, ctx, request, () =>
        proxyRequest(
          `https://frodo.douban.com/api/v2/book/${subjectId}?apikey=0ac44ae016490db2204ce0a042db2916`,
          request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
        )
      );
    }

    if (url.pathname === "/api/douban/movie/suggest") {
      const query = url.searchParams.get("q") ?? "";
      const target = new URL("https://movie.douban.com/j/subject_suggest");
      target.searchParams.set("q", query);
      return proxyRequest(target.toString(), request, { extraHeaders: { Referer: "https://movie.douban.com/" } });
    }

    if (url.pathname === "/api/douban/movie/search") {
      const query = url.searchParams.get("q") ?? "";
      const target = new URL("https://www.douban.com/search");
      target.searchParams.set("cat", "1002");
      target.searchParams.set("q", query);
      return proxyRequest(target.toString(), request, { cacheTtl: 1800 });
    }

    const celebrityWorksMatch = url.pathname.match(/^\/api\/douban\/celebrity\/(\d+)\/works\/?$/);
    if (celebrityWorksMatch) {
      const celebrityId = celebrityWorksMatch[1];
      const frodoHeaders = {
        "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
        Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
      };
      const start = url.searchParams.get("start") ?? "0";
      const count = url.searchParams.get("count") ?? "50";
      return cachedProxy(`celebrity-works:${celebrityId}:${start}:${count}`, env, ctx, request, () =>
        proxyRequest(
          `https://frodo.douban.com/api/v2/celebrity/${celebrityId}/works?apikey=0ac44ae016490db2204ce0a042db2916&start=${start}&count=${count}`,
          request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
        )
      );
    }

    const celebrityMatch = url.pathname.match(/^\/api\/douban\/celebrity\/(\d+)\/?$/);
    if (celebrityMatch) {
      const celebrityId = celebrityMatch[1];
      const frodoHeaders = {
        "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
        Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
      };
      return cachedProxy(`celebrity:${celebrityId}`, env, ctx, request, () =>
        proxyRequest(
          `https://frodo.douban.com/api/v2/celebrity/${celebrityId}?apikey=0ac44ae016490db2204ce0a042db2916`,
          request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
        )
      );
    }

    const movieCreditsMatch = url.pathname.match(/^\/api\/douban\/movie\/(\d+)\/credits\/?$/);
    if (movieCreditsMatch) {
      const subjectId = movieCreditsMatch[1];
      const frodoHeaders = {
        "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
        Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
      };
      return cachedProxy(`movie-credits:${subjectId}`, env, ctx, request, () =>
        proxyRequest(
          `https://frodo.douban.com/api/v2/movie/${subjectId}/credits?apikey=0ac44ae016490db2204ce0a042db2916&count=50`,
          request, { cacheTtl: 86400, extraHeaders: frodoHeaders }
        )
      );
    }

    const movieMatch = url.pathname.match(/^\/api\/douban\/movie\/(\d+)\/?$/);
    if (movieMatch) {
      const subjectId = movieMatch[1];
      const frodoHeaders = {
        "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
        Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
      };
      return cachedProxy(`movie:${subjectId}`, env, ctx, request, async () => {
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

    const collectionItemsMatch = url.pathname.match(/^\/api\/douban\/collection\/([A-Za-z0-9_]+)\/items\/?$/);
    if (collectionItemsMatch) {
      const collectionId = collectionItemsMatch[1];
      const start = url.searchParams.get("start") ?? "0";
      const count = url.searchParams.get("count") ?? "20";
      const rexxarHeaders = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        Referer: "https://m.douban.com/"
      };
      return proxyRequest(
        `https://m.douban.com/rexxar/api/v2/subject_collection/${collectionId}/items?start=${start}&count=${count}`,
        request, { cacheTtl: 300, extraHeaders: rexxarHeaders }
      );
    }

    const collectionMetaMatch = url.pathname.match(/^\/api\/douban\/collection\/([A-Za-z0-9_]+)\/?$/);
    if (collectionMetaMatch) {
      const collectionId = collectionMetaMatch[1];
      const rexxarHeaders = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        Referer: "https://m.douban.com/"
      };
      return proxyRequest(
        `https://m.douban.com/rexxar/api/v2/subject_collection/${collectionId}`,
        request, { cacheTtl: 300, extraHeaders: rexxarHeaders }
      );
    }

    if (url.pathname === "/api/douban/image") {
      const source = url.searchParams.get("url");
      if (!source) {
        return new Response("Missing image url", { status: 400 });
      }

      return proxyRequest(source, request, { cacheTtl: 604800 });
    }

    return env.ASSETS.fetch(request);
  }
};
