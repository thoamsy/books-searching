import { queryOptions } from "@tanstack/react-query";
import { getCollectionItems } from "@/lib/collection-api";

export function collectionItemsQueryOptions(
  collectionId: string,
  start = 0,
  count = 20
) {
  return queryOptions({
    queryKey: ["collection", "items", collectionId, start, count],
    queryFn: () => getCollectionItems(collectionId, start, count),
    enabled: Boolean(collectionId),
    staleTime: 5 * 60_000
  });
}
