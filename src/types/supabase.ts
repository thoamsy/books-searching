export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchHistoryRow {
  id: number;
  user_id: string;
  keyword: string;
  type: "book" | "movie" | "author";
  extra: Record<string, unknown>;
  searched_at: string;
}

export interface BookmarkRow {
  id: number;
  user_id: string;
  item_id: string;
  item_type: "book" | "movie";
  item_title: string;
  item_cover_url: string | null;
  status: "want" | "done";
  recommendation: "up" | "down" | null;
  created_at: string;
  updated_at: string;
}
