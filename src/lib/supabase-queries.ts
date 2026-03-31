import { queryOptions } from "@tanstack/react-query";
import { getSearchHistory } from "@/lib/supabase-api";

export function searchHistoryQueryOptions(userId: string) {
  return queryOptions({
    queryKey: ["search-history", userId],
    queryFn: () => getSearchHistory(userId),
    enabled: Boolean(userId),
    staleTime: 1000 * 60,
  });
}
