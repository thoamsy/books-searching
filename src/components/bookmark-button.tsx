import { Star } from "lucide-react";
import { useParams } from "react-router-dom";
import { useQueryClient, useQuery, type QueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  bookmarksQueryOptions,
  useAddBookmark,
  useRemoveBookmark,
} from "@/lib/bookmark-queries";
import { cn } from "@/lib/utils";
import type { BookmarkRow } from "@/types/supabase";
import type { BookDetail } from "@/types/books";
import type { MovieDetail, CelebrityDetail } from "@/types/movies";

type BookmarkType = BookmarkRow["item_type"];

function useBookmarkContext(): { itemId: string; itemType: BookmarkType } | null {
  const params = useParams();

  if (params.workId) return { itemId: params.workId, itemType: "book" };
  if (params.subjectId) return { itemId: params.subjectId, itemType: "movie" };
  if (params.celebrityId) return { itemId: params.celebrityId, itemType: "celebrity" };
  if (params.authorName) return { itemId: decodeURIComponent(params.authorName), itemType: "author" };

  return null;
}

function getItemMeta(queryClient: QueryClient, itemId: string, itemType: BookmarkType): { title: string; coverUrl: string | null } {
  if (itemType === "book") {
    const detail = queryClient.getQueryData<BookDetail>(["books", "detail", itemId]);
    if (detail) return { title: detail.title, coverUrl: detail.coverUrl ?? null };
  }

  if (itemType === "movie") {
    const detail = queryClient.getQueryData<MovieDetail>(["movies", "detail", itemId]);
    if (detail) return { title: detail.title, coverUrl: detail.coverUrl ?? null };
  }

  if (itemType === "celebrity") {
    const detail = queryClient.getQueryData<CelebrityDetail>(["celebrity", "detail", itemId]);
    if (detail) return { title: detail.name, coverUrl: detail.coverUrl ?? null };
  }

  if (itemType === "author") {
    const params = new URLSearchParams(window.location.search);
    return { title: itemId, coverUrl: params.get("photo") };
  }

  return { title: itemId, coverUrl: null };
}

export function BookmarkButton() {
  const ctx = useBookmarkContext();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const { data: bookmarks = [] } = useQuery(bookmarksQueryOptions(userId));
  const addMutation = useAddBookmark();
  const removeMutation = useRemoveBookmark();

  if (!ctx) return null;

  const { itemId, itemType } = ctx;
  const isBookmarked = bookmarks.some((b) => b.item_id === itemId);

  function handleToggle() {
    if (isBookmarked) {
      removeMutation.mutate(itemId);
    } else {
      const meta = getItemMeta(queryClient, itemId, itemType);
      addMutation.mutate({
        item_id: itemId,
        item_type: itemType,
        item_title: meta.title,
        item_cover_url: meta.coverUrl,
        created_at: new Date().toISOString(),
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isBookmarked ? "取消收藏" : "加入收藏"}
      aria-pressed={isBookmarked}
      className="inline-flex items-center justify-center rounded-full p-2 transition hover:bg-accent"
    >
      <Star
        className={cn(
          "size-5 transition-colors",
          isBookmarked ? "fill-current text-star" : "text-muted-foreground"
        )}
      />
    </button>
  );
}
