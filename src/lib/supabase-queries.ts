import { queryOptions } from "@tanstack/react-query";
import { readLocalAsRows } from "@/lib/history-utils";
import { getSearchHistory } from "@/lib/supabase-api";

export function searchHistoryQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: ["search-history", userId ?? "local"] as const,
    queryFn: userId
      ? () => getSearchHistory(userId)
      : () => Promise.resolve(readLocalAsRows()),
    placeholderData: readLocalAsRows,
    staleTime: userId ? 60_000 : Infinity,
  });
}
