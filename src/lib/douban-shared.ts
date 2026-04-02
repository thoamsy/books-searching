// src/lib/douban-shared.ts

export const API_BASE = (import.meta.env.VITE_DOUBAN_PROXY_BASE ?? "").replace(/\/$/, "");

export function normalizeUrl(url?: string | null) {
  if (!url) {
    return undefined;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  return url.replace("http://", "https://");
}

export function proxifyImageUrl(url?: string) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return undefined;
  }

  if (!normalized.includes("doubanio.com")) {
    return normalized;
  }

  return `${API_BASE}/api/douban/image?url=${encodeURIComponent(normalized)}`;
}

export function fetchProxy(path: string, accept = "text/html,application/xhtml+xml") {
  return fetch(`${API_BASE}${path}`, {
    headers: { Accept: accept },
  });
}

/** Extract collection ID from douban URI like "douban://douban.com/subject_collection/ECZZABULI?..." */
export function extractCollectionId(uri?: string): string | undefined {
  if (!uri) return undefined;
  const match = uri.match(/subject_collection\/([^?/]+)/);
  return match?.[1];
}
