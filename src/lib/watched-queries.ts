import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  getWatchedItems,
  removeWatchedItem,
  updateWatchedItemDate,
  upsertWatchedItem,
  type WatchedItemInput,
} from "@/lib/supabase-api";
import type { WatchedItemRow } from "@/types/supabase";

export type WatchedItem = WatchedItemRow;

const watchedItemsBaseQueryKey = ["watched-items"] as const;

export function watchedItemsQueryKey(userId: string | null) {
  return [...watchedItemsBaseQueryKey, userId ?? "anonymous"] as const;
}

function sortWatchedItems(items: WatchedItem[]) {
  return [...items].sort((a, b) => {
    const dateCompare = b.watched_on.localeCompare(a.watched_on);
    if (dateCompare !== 0) return dateCompare;
    return b.created_at.localeCompare(a.created_at);
  });
}

function replaceWatchedItem(items: WatchedItem[], next: WatchedItem) {
  return sortWatchedItems([
    next,
    ...items.filter(
      (item) => item.item_id !== next.item_id || item.item_type !== next.item_type
    ),
  ]);
}

export function watchedItemsQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: watchedItemsQueryKey(userId),
    queryFn: userId ? () => getWatchedItems(userId) : (): Promise<WatchedItem[]> => Promise.resolve([]),
    staleTime: userId ? 60_000 : Infinity,
  });
}

export function useUpsertWatchedItem() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: WatchedItemInput) => {
      if (!userId) {
        throw new Error("Login is required to mark watched items.");
      }
      return upsertWatchedItem(userId, item);
    },
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: watchedItemsBaseQueryKey });
      const previousQueries = queryClient.getQueriesData<WatchedItem[]>({
        queryKey: watchedItemsBaseQueryKey,
      });
      const currentItems =
        previousQueries.find(([, items]) =>
          items?.some(
            (existing) =>
              existing.item_id === item.item_id && existing.item_type === item.item_type
          )
        )?.[1] ?? [];
      const now = new Date().toISOString();
      const optimistic: WatchedItem = {
        id: -Date.now(),
        user_id: userId ?? "",
        item_id: item.item_id,
        item_type: item.item_type,
        media_kind: item.media_kind,
        item_title: item.item_title,
        item_cover_url: item.item_cover_url,
        watched_on: item.watched_on,
        created_at: currentItems.find(
          (existing) =>
            existing.item_id === item.item_id && existing.item_type === item.item_type
        )?.created_at ?? now,
        updated_at: now,
      };
      queryClient.setQueriesData<WatchedItem[]>({ queryKey: watchedItemsBaseQueryKey }, (old = []) =>
        replaceWatchedItem(old, optimistic)
      );
      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      for (const [queryKey, data] of context?.previousQueries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSuccess: (row) => {
      queryClient.setQueriesData<WatchedItem[]>({ queryKey: watchedItemsBaseQueryKey }, (old = []) =>
        replaceWatchedItem(old, row)
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: watchedItemsBaseQueryKey });
    },
  });
}

export function useUpdateWatchedItemDate() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      itemType,
      watchedOn,
    }: {
      itemId: string;
      itemType: WatchedItemRow["item_type"];
      watchedOn: string;
    }) => {
      if (!userId) {
        throw new Error("Login is required to update watched items.");
      }
      return updateWatchedItemDate(userId, itemId, itemType, watchedOn);
    },
    onMutate: async ({ itemId, itemType, watchedOn }) => {
      await queryClient.cancelQueries({ queryKey: watchedItemsBaseQueryKey });
      const previousQueries = queryClient.getQueriesData<WatchedItem[]>({
        queryKey: watchedItemsBaseQueryKey,
      });
      queryClient.setQueriesData<WatchedItem[]>({ queryKey: watchedItemsBaseQueryKey }, (old = []) =>
        sortWatchedItems(
          old.map((item) =>
            item.item_id === itemId && item.item_type === itemType
              ? { ...item, watched_on: watchedOn, updated_at: new Date().toISOString() }
              : item
          )
        )
      );
      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      for (const [queryKey, data] of context?.previousQueries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSuccess: (row) => {
      queryClient.setQueriesData<WatchedItem[]>({ queryKey: watchedItemsBaseQueryKey }, (old = []) =>
        replaceWatchedItem(old, row)
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: watchedItemsBaseQueryKey });
    },
  });
}

export function useRemoveWatchedItem() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      itemType,
    }: {
      itemId: string;
      itemType: WatchedItemRow["item_type"];
    }) => {
      if (!userId) {
        throw new Error("Login is required to remove watched items.");
      }
      await removeWatchedItem(userId, itemId, itemType);
    },
    onMutate: async ({ itemId, itemType }) => {
      await queryClient.cancelQueries({ queryKey: watchedItemsBaseQueryKey });
      const previousQueries = queryClient.getQueriesData<WatchedItem[]>({
        queryKey: watchedItemsBaseQueryKey,
      });
      queryClient.setQueriesData<WatchedItem[]>({ queryKey: watchedItemsBaseQueryKey }, (old = []) =>
        old.filter((item) => item.item_id !== itemId || item.item_type !== itemType)
      );
      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      for (const [queryKey, data] of context?.previousQueries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: watchedItemsBaseQueryKey });
    },
  });
}
