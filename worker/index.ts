interface Env {
  ASSETS: Fetcher;
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

export default {
  async fetch(request: Request, env: Env) {
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
      return proxyRequest(`https://book.douban.com/subject/${subjectId}/`, request, { cacheTtl: 86400 });
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

    const movieMatch = url.pathname.match(/^\/api\/douban\/movie\/(\d+)\/?$/);
    if (movieMatch) {
      const subjectId = movieMatch[1];
      const frodoHeaders = {
        "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
        Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
      };
      // Try /movie/ first, fall back to /tv/ for TV shows
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
