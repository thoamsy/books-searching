import type { BookmarkRow } from "@/types/supabase";

export type LocalBookmark = Pick<BookmarkRow, "item_id" | "item_type" | "item_title" | "item_cover_url"> & {
  item_cover_urls?: string[] | null;
  created_at: string;
};

const STORAGE_KEY = "bookmarks";

export function readLocalBookmarks(): LocalBookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is LocalBookmark =>
        item != null &&
        typeof item === "object" &&
        typeof (item as LocalBookmark).item_id === "string" &&
        typeof (item as LocalBookmark).item_type === "string" &&
        typeof (item as LocalBookmark).item_title === "string"
    );
  } catch {
    return [];
  }
}

export function writeLocalBookmarks(bookmarks: LocalBookmark[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function addLocalBookmark(bookmark: LocalBookmark) {
  const existing = readLocalBookmarks();
  const filtered = existing.filter((b) => b.item_id !== bookmark.item_id);
  writeLocalBookmarks([bookmark, ...filtered]);
}

export function removeLocalBookmark(itemId: string) {
  const existing = readLocalBookmarks();
  writeLocalBookmarks(existing.filter((b) => b.item_id !== itemId));
}

export function clearLocalBookmarks() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
