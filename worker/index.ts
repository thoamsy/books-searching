interface Env {
  ASSETS: Fetcher;
}

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Referer: "https://www.douban.com/"
};

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

async function proxyRequest(target: string, request: Request, extraHeaders?: Record<string, string>) {
  const upstream = await fetch(target, {
    headers: {
      ...DEFAULT_HEADERS,
      ...extraHeaders
    },
    cf: {
      cacheEverything: true,
      cacheTtl: 300
    }
  });

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
      return proxyRequest(target.toString(), request, { Referer: "https://book.douban.com/" });
    }

    if (url.pathname === "/api/douban/search") {
      const query = url.searchParams.get("q") ?? "";
      const target = new URL("https://www.douban.com/search");
      target.searchParams.set("cat", "1001");
      target.searchParams.set("q", query);
      return proxyRequest(target.toString(), request);
    }

    const bookMatch = url.pathname.match(/^\/api\/douban\/book\/(\d+)\/?$/);
    if (bookMatch) {
      const subjectId = bookMatch[1];
      return proxyRequest(`https://book.douban.com/subject/${subjectId}/`, request);
    }

    if (url.pathname === "/api/douban/image") {
      const source = url.searchParams.get("url");
      if (!source) {
        return new Response("Missing image url", { status: 400 });
      }

      return proxyRequest(source, request);
    }

    return env.ASSETS.fetch(request);
  }
};
