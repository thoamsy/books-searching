import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { addBookmark, getBookmarks, removeBookmark } from "@/lib/supabase-api";
import {
  addLocalBookmark,
  readLocalBookmarks,
  removeLocalBookmark,
  type LocalBookmark,
} from "@/lib/bookmark-store";
import type { BookmarkRow } from "@/types/supabase";

// Shared type for both local and cloud bookmarks displayed in UI
export type BookmarkItem = Pick<BookmarkRow, "item_id" | "item_type" | "item_title" | "item_cover_url"> & {
  item_cover_urls?: string[] | null;
  created_at: string;
};

function bookmarksQueryKey(userId: string | null) {
  return ["bookmarks", userId ?? "local"] as const;
}

export function bookmarksQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: bookmarksQueryKey(userId),
    queryFn: userId
      ? async (): Promise<BookmarkItem[]> => {
          const rows = await getBookmarks(userId);
          return rows.map((r) => ({
            item_id: r.item_id,
            item_type: r.item_type,
            item_title: r.item_title,
            item_cover_url: r.item_cover_url,
            item_cover_urls: r.item_cover_urls,
            created_at: r.created_at,
          }));
        }
      : (): Promise<BookmarkItem[]> => Promise.resolve(readLocalBookmarks()),
    staleTime: userId ? 60_000 : Infinity,
  });
}

export function useAddBookmark() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const key = bookmarksQueryKey(userId);

  return useMutation({
    mutationFn: async (bookmark: LocalBookmark) => {
      if (userId) {
        await addBookmark(userId, bookmark);
      } else {
        addLocalBookmark(bookmark);
      }
    },
    onMutate: async (bookmark) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BookmarkItem[]>(key);
      queryClient.setQueryData<BookmarkItem[]>(key, (old = []) => [
        bookmark,
        ...old.filter((b) => b.item_id !== bookmark.item_id),
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData<BookmarkItem[]>(key, context.previous);
      }
    },
  });
}

export function useRemoveBookmark() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const key = bookmarksQueryKey(userId);

  return useMutation({
    mutationFn: async (itemId: string) => {
      if (userId) {
        await removeBookmark(userId, itemId);
      } else {
        removeLocalBookmark(itemId);
      }
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BookmarkItem[]>(key);
      queryClient.setQueryData<BookmarkItem[]>(key, (old = []) =>
        old.filter((b) => b.item_id !== itemId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData<BookmarkItem[]>(key, context.previous);
      }
    },
  });
}
