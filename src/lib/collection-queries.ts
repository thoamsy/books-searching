import { infiniteQueryOptions } from "@tanstack/react-query";
import { getCollectionItems } from "@/lib/collection-api";

const PAGE_SIZE = 20;

export function collectionItemsQueryOptions(collectionId: string) {
  return infiniteQueryOptions({
    queryKey: ["collection", "items", collectionId],
    queryFn: ({ pageParam }) =>
      getCollectionItems(collectionId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const next = lastPage.start + lastPage.count;
      return next < lastPage.total ? next : undefined;
    },
    enabled: Boolean(collectionId),
    staleTime: 5 * 60_000
  });
}
