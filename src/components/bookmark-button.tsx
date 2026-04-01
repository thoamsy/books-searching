import { Star } from "lucide-react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LazyMotion, domMax, m, MotionConfig, AnimatePresence, useAnimate } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import {
  bookmarksQueryOptions,
  useAddBookmark,
  useRemoveBookmark,
} from "@/lib/bookmark-queries";
import { bookDetailQueryOptions } from "@/lib/book-queries";
import { movieDetailQueryOptions } from "@/lib/movie-queries";
import { celebrityDetailQueryOptions } from "@/lib/celebrity-queries";
import { cn } from "@/lib/utils";
import type { BookmarkRow } from "@/types/supabase";

type BookmarkType = BookmarkRow["item_type"];

function useBookmarkContext(): { itemId: string; itemType: BookmarkType } | null {
  const params = useParams();

  if (params.workId) return { itemId: params.workId, itemType: "book" };
  if (params.subjectId) return { itemId: params.subjectId, itemType: "movie" };
  if (params.celebrityId) return { itemId: params.celebrityId, itemType: "celebrity" };
  if (params.authorName) return { itemId: decodeURIComponent(params.authorName), itemType: "author" };

  return null;
}

function useItemMeta(itemId: string, itemType: BookmarkType) {
  const bookQuery = useQuery({
    ...bookDetailQueryOptions(itemType === "book" ? itemId : ""),
    enabled: itemType === "book",
  });
  const movieQuery = useQuery({
    ...movieDetailQueryOptions(itemType === "movie" ? itemId : ""),
    enabled: itemType === "movie",
  });
  const celebrityQuery = useQuery({
    ...celebrityDetailQueryOptions(itemType === "celebrity" ? itemId : ""),
    enabled: itemType === "celebrity",
  });

  if (itemType === "book") {
    const detail = bookQuery.data;
    if (!detail) return null;
    return { title: detail.title, coverUrl: detail.coverUrl ?? null };
  }

  if (itemType === "movie") {
    const detail = movieQuery.data;
    if (!detail) return null;
    return { title: detail.title, coverUrl: detail.coverUrl ?? null };
  }

  if (itemType === "celebrity") {
    const detail = celebrityQuery.data;
    if (!detail) return null;
    return { title: detail.name, coverUrl: detail.coverUrl ?? null };
  }

  if (itemType === "author") {
    const params = new URLSearchParams(window.location.search);
    return { title: itemId, coverUrl: params.get("photo") };
  }

  return null;
}

export function BookmarkButton() {
  const ctx = useBookmarkContext();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: bookmarks = [] } = useQuery(bookmarksQueryOptions(userId));
  const addMutation = useAddBookmark();
  const removeMutation = useRemoveBookmark();

  const meta = useItemMeta(ctx?.itemId ?? "", ctx?.itemType ?? "book");
  const [starRef, animateStar] = useAnimate();

  if (!ctx || !meta?.title) return null;

  const { itemId, itemType } = ctx;
  const { title, coverUrl } = meta;
  const isBookmarked = bookmarks.some((b) => b.item_id === itemId);

  function handleToggle() {
    if (isBookmarked) {
      removeMutation.mutate(itemId);
    } else {
      addMutation.mutate({
        item_id: itemId,
        item_type: itemType,
        item_title: title,
        item_cover_url: coverUrl,
        created_at: new Date().toISOString(),
      });
      // Fire-and-forget: pop animation only on user-initiated bookmark
      void animateStar(
        starRef.current,
        { scale: [1, 1.3, 0.9, 1.05, 1], rotate: [0, -14, 10, -4, 0] },
        { duration: 0.45, ease: [0.2, 1, 0.3, 1] },
      );
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax} strict>
        <m.button
          type="button"
          onClick={handleToggle}
          aria-label={isBookmarked ? "取消收藏" : "加入收藏"}
          aria-pressed={isBookmarked}
          className="relative inline-flex items-center justify-center rounded-full p-2 transition hover:bg-accent"
          whileTap={{ scale: 0.85 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          {/* Background glow that blooms when bookmarked */}
          <AnimatePresence>
            {isBookmarked && (
              <m.span
                className="absolute inset-0 rounded-full bg-star/15"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
            )}
          </AnimatePresence>
          <span ref={starRef} className="relative inline-flex">
            <Star
              className={cn(
                "size-5 transition-colors duration-300",
                isBookmarked ? "fill-current text-star" : "text-muted-foreground"
              )}
            />
          </span>
        </m.button>
      </LazyMotion>
    </MotionConfig>
  );
}
