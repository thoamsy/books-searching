export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookmarkRow {
  id: number;
  user_id: string;
  item_id: string;
  item_type: "book" | "movie" | "author" | "celebrity" | "collection";
  item_title: string;
  item_cover_url: string | null;
  item_cover_urls: string[] | null;
  status: "want" | "done";
  recommendation: "up" | "down" | null;
  created_at: string;
  updated_at: string;
}
