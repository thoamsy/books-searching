import path from "node:path";
import { Buffer } from "node:buffer";
import { defineConfig } from "vite";
import type { ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

function createDoubanProxy(target: string, rewrite: ProxyOptions["rewrite"]) {
  return {
    target,
    changeOrigin: true,
    rewrite,
    configure(proxy) {
      proxy.on("proxyReq", (proxyReq) => {
        proxyReq.setHeader(
          "User-Agent",
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );
        proxyReq.setHeader("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
        proxyReq.setHeader("Referer", "https://www.douban.com/");
      });
    }
  } satisfies ProxyOptions;
}

export default defineConfig({
  plugins: [
    {
      name: "douban-image-proxy",
      configureServer(server) {
        server.middlewares.use("/api/douban/image", async (req, res) => {
          const requestUrl = new URL(req.url ?? "", "http://localhost");
          const source = requestUrl.searchParams.get("url");

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
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Book Echo",
        short_name: "Book Echo",
        description: "Search books, authors, and editions in a clean PWA.",
        theme_color: "#f6efe5",
        background_color: "#f6efe5",
        display: "standalone",
        start_url: "/",
        icons: [
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
      "/api/douban/book": createDoubanProxy("https://book.douban.com", (path) =>
        path.replace(/^\/api\/douban\/book/, "/subject")
      )
    }
  }
});
