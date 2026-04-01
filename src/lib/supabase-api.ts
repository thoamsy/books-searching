import { supabase } from "@/lib/supabase";
import type { BookmarkRow } from "@/types/supabase";

export async function getBookmarks(userId: string): Promise<BookmarkRow[]> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addBookmark(
  userId: string,
  bookmark: Pick<BookmarkRow, "item_id" | "item_type" | "item_title" | "item_cover_url">
) {
  const { error } = await supabase.from("bookmarks").upsert(
    {
      user_id: userId,
      item_id: bookmark.item_id,
      item_type: bookmark.item_type,
      item_title: bookmark.item_title,
      item_cover_url: bookmark.item_cover_url,
      status: "want",
    },
    { onConflict: "user_id,item_id" }
  );
  if (error) throw error;
}

export async function removeBookmark(userId: string, itemId: string) {
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId);
  if (error) throw error;
}

export async function batchUpsertBookmarks(
  userId: string,
  bookmarks: Array<Pick<BookmarkRow, "item_id" | "item_type" | "item_title" | "item_cover_url">>
) {
  if (bookmarks.length === 0) return;
  const rows = bookmarks.map((b) => ({
    user_id: userId,
    item_id: b.item_id,
    item_type: b.item_type,
    item_title: b.item_title,
    item_cover_url: b.item_cover_url,
    status: "want" as const,
  }));
  const { error } = await supabase
    .from("bookmarks")
    .upsert(rows, { onConflict: "user_id,item_id" });
  if (error) throw error;
}
