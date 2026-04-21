import path from "node:path";
import { Buffer } from "node:buffer";
import { defineConfig } from "vite";
import type { ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const DOUBAN_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Referer: "https://www.douban.com/",
  Cookie: "bid=JKl8gT2Nxfw"
};

function createDoubanProxy(target: string, rewrite: ProxyOptions["rewrite"]) {
  return {
    target,
    changeOrigin: true,
    rewrite,
    selfHandleResponse: true,
    configure(proxy) {
      proxy.on("proxyReq", (proxyReq) => {
        for (const [key, value] of Object.entries(DOUBAN_HEADERS)) {
          proxyReq.setHeader(key, value);
        }
      });
      proxy.on("proxyRes", (proxyRes, _req, res) => {
        // Douban may redirect to sec.douban.com for security challenges.
        // Intercept and return 429 instead of leaking the redirect to the browser.
        if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400
          && proxyRes.headers.location?.includes("sec.douban.com")) {
          res.writeHead(429, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "rate-limited" }));
          return;
        }
        res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
        proxyRes.pipe(res);
      });
    }
  } satisfies ProxyOptions;
}

export default defineConfig({
  test: {
    environment: "jsdom",
    testTimeout: 30_000
  },
  plugins: [
    {
      name: "douban-image-proxy",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const requestUrl = new URL(req.url ?? "", "http://localhost");
          const mediaPrefix = "/media/douban/";
          if (!requestUrl.pathname.startsWith(mediaPrefix)) {
            return next();
          }

          const encodedSource = requestUrl.pathname.slice(mediaPrefix.length);
          let source = "";

          try {
            source = decodeURIComponent(encodedSource);
          } catch {
            res.statusCode = 400;
            res.end("Invalid image url");
            return;
          }

          if (!source) {
            res.statusCode = 400;
            res.end("Missing image url");
            return;
          }

          try {
            const upstream = await fetch(source, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                Referer: "https://book.douban.com/"
              }
            });

            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.end("Image proxy failed");
              return;
            }

            const arrayBuffer = await upstream.arrayBuffer();
            res.statusCode = 200;
            res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "image/jpeg");
            res.setHeader("Cache-Control", "public, max-age=300");
            res.end(Buffer.from(arrayBuffer));
          } catch {
            res.statusCode = 502;
            res.end("Image proxy error");
          }
        });
      }
    },
    {
      name: "douban-book-detail-proxy",
      configureServer(server) {
        const FRODO_HEADERS = {
          "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
          Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
        };

        server.middlewares.use(async (req, res, next) => {
          const match = req.url?.match(/^\/api\/douban\/book\/(\d+)\/?$/);
          if (!match) return next();

          const subjectId = match[1];
          const apikey = "0ac44ae016490db2204ce0a042db2916";

          try {
            const upstream = await fetch(
              `https://frodo.douban.com/api/v2/book/${subjectId}?apikey=${apikey}`,
              { headers: FRODO_HEADERS }
            );

            const body = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
            res.setHeader("Cache-Control", "public, max-age=300");
            res.end(body);
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: "proxy error" }));
          }
        });
      }
    },
    {
      name: "douban-movie-detail-proxy",
      configureServer(server) {
        const FRODO_HEADERS = {
          "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
          Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
        };

        // Credits endpoint (must come before the detail catch-all)
        server.middlewares.use(async (req, res, next) => {
          const creditsMatch = req.url?.match(/^\/api\/douban\/movie\/(\d+)\/credits\/?$/);
          if (!creditsMatch) return next();

          const subjectId = creditsMatch[1];
          const apikey = "0ac44ae016490db2204ce0a042db2916";

          try {
            const upstream = await fetch(
              `https://frodo.douban.com/api/v2/movie/${subjectId}/credits?apikey=${apikey}&count=50`,
              { headers: FRODO_HEADERS }
            );
            const body = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
            res.setHeader("Cache-Control", "public, max-age=300");
            res.end(body);
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: "proxy error" }));
          }
        });

        server.middlewares.use(async (req, res, next) => {
          const match = req.url?.match(/^\/api\/douban\/movie\/(\d+)\/?$/);
          if (!match) return next();

          const subjectId = match[1];
          const apikey = "0ac44ae016490db2204ce0a042db2916";

          try {
            // Try /movie/ first, fall back to /tv/
            let upstream = await fetch(
              `https://frodo.douban.com/api/v2/movie/${subjectId}?apikey=${apikey}`,
              { headers: FRODO_HEADERS }
            );
            if (upstream.status === 400 || upstream.status === 404) {
              upstream = await fetch(
                `https://frodo.douban.com/api/v2/tv/${subjectId}?apikey=${apikey}`,
                { headers: FRODO_HEADERS }
              );
            }

            const body = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
            res.setHeader("Cache-Control", "public, max-age=300");
            res.end(body);
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: "proxy error" }));
          }
        });
      }
    },
    {
      name: "douban-celebrity-proxy",
      configureServer(server) {
        const FRODO_HEADERS = {
          "User-Agent": "MicroMessenger/7.0.0 (iPhone; iOS 14.0; Scale/2.00)",
          Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/91/page-frame.html"
        };

        server.middlewares.use(async (req, res, next) => {
          const worksMatch = req.url?.match(/^\/api\/douban\/celebrity\/(\d+)\/works\/?(\?.*)?$/);
          if (worksMatch) {
            const celebrityId = worksMatch[1];
            const search = worksMatch[2] ?? "";
            const params = new URLSearchParams(search);
            const start = params.get("start") ?? "0";
            const count = params.get("count") ?? "50";
            const apikey = "0ac44ae016490db2204ce0a042db2916";

            try {
              const upstream = await fetch(
                `https://frodo.douban.com/api/v2/celebrity/${celebrityId}/works?apikey=${apikey}&start=${start}&count=${count}`,
                { headers: FRODO_HEADERS }
              );
              const body = await upstream.text();
              res.statusCode = upstream.status;
              res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
              res.setHeader("Cache-Control", "public, max-age=300");
              res.end(body);
            } catch {
              res.statusCode = 502;
              res.end(JSON.stringify({ error: "proxy error" }));
            }
            return;
          }

          const match = req.url?.match(/^\/api\/douban\/celebrity\/(\d+)\/?$/);
          if (!match) return next();

          const celebrityId = match[1];
          const apikey = "0ac44ae016490db2204ce0a042db2916";

          try {
            const upstream = await fetch(
              `https://frodo.douban.com/api/v2/celebrity/${celebrityId}?apikey=${apikey}`,
              { headers: FRODO_HEADERS }
            );
            const body = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
            res.setHeader("Cache-Control", "public, max-age=300");
            res.end(body);
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: "proxy error" }));
          }
        });
      }
    },
    {
      name: "douban-collection-proxy",
      configureServer(server) {
        const REXXAR_HEADERS = {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
          Referer: "https://m.douban.com/"
        };

        // Items endpoint (must come before metadata catch-all)
        server.middlewares.use(async (req, res, next) => {
          const match = req.url?.match(
            /^\/api\/douban\/collection\/([A-Za-z0-9_]+)\/items\/?(\?.*)?$/
          );
          if (!match) return next();

          const collectionId = match[1];
          const search = match[2] ?? "";
          const params = new URLSearchParams(search);
          const start = params.get("start") ?? "0";
          const count = params.get("count") ?? "20";

          try {
            const upstream = await fetch(
              `https://m.douban.com/rexxar/api/v2/subject_collection/${collectionId}/items?start=${start}&count=${count}`,
              { headers: REXXAR_HEADERS }
            );
            const body = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader(
              "Content-Type",
              upstream.headers.get("content-type") ?? "application/json"
            );
            res.setHeader("Cache-Control", "public, max-age=300");
            res.end(body);
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: "proxy error" }));
          }
        });

        // Metadata endpoint
        server.middlewares.use(async (req, res, next) => {
          const match = req.url?.match(
            /^\/api\/douban\/collection\/([A-Za-z0-9_]+)\/?$/
          );
          if (!match) return next();

          const collectionId = match[1];

          try {
            const upstream = await fetch(
              `https://m.douban.com/rexxar/api/v2/subject_collection/${collectionId}`,
              { headers: REXXAR_HEADERS }
            );
            const body = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader(
              "Content-Type",
              upstream.headers.get("content-type") ?? "application/json"
            );
            res.setHeader("Cache-Control", "public, max-age=300");
            res.end(body);
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: "proxy error" }));
          }
        });
      }
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/media\//]
      },
      manifest: {
        name: "Opus",
        short_name: "Opus",
        description: "一个安静的书影搜索 PWA。",
        theme_color: "#f6efe5",
        background_color: "#f6efe5",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any"
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    proxy: {
      "/api/douban/suggest": createDoubanProxy("https://book.douban.com", (path) =>
        path.replace(/^\/api\/douban\/suggest/, "/j/subject_suggest")
      ),
      "/api/douban/search": createDoubanProxy("https://www.douban.com", (path) =>
        path.replace(/^\/api\/douban\/search/, "/search")
      ),
      "/api/douban/movie/suggest": createDoubanProxy("https://movie.douban.com", (path) =>
        path.replace(/^\/api\/douban\/movie\/suggest/, "/j/subject_suggest")
      ),
      "/api/douban/movie/search": createDoubanProxy("https://www.douban.com", (path) =>
        path.replace(/^\/api\/douban\/movie\/search/, "/search")
      )
    }
  }
});
