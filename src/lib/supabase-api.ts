import { supabase } from "@/lib/supabase";
import type { SearchHistoryRow } from "@/types/supabase";

export async function getSearchHistory(userId: string): Promise<SearchHistoryRow[]> {
  const { data, error } = await supabase
    .from("search_history")
    .select("*")
    .eq("user_id", userId)
    .order("searched_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function upsertSearchHistory(
  userId: string,
  keyword: string,
  type: SearchHistoryRow["type"],
  extra: Record<string, unknown> = {}
) {
  const { error } = await supabase
    .from("search_history")
    .upsert(
      { user_id: userId, keyword, type, extra, searched_at: new Date().toISOString() },
      { onConflict: "user_id,keyword,type" }
    );
  if (error) throw error;
}

export async function clearSearchHistory(userId: string) {
  const { error } = await supabase
    .from("search_history")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

export async function batchUpsertSearchHistory(
  userId: string,
  entries: Array<{ keyword: string; type: SearchHistoryRow["type"]; extra?: Record<string, unknown> }>
) {
  if (entries.length === 0) return;
  const now = new Date().toISOString();
  const rows = entries.map((e) => ({
    user_id: userId,
    keyword: e.keyword,
    type: e.type,
    extra: e.extra ?? {},
    searched_at: now,
  }));
  const { error } = await supabase
    .from("search_history")
    .upsert(rows, { onConflict: "user_id,keyword,type" });
  if (error) throw error;
}
