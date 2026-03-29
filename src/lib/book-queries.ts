import { queryOptions } from "@tanstack/react-query";
import { getBookDetail, getSuggestions, searchBooks } from "@/lib/books-api";

export function searchBooksQueryOptions(query: string) {
  return queryOptions({
    queryKey: ["books", "search", query],
    queryFn: () => searchBooks(query),
    enabled: Boolean(query.trim()),
    staleTime: 5 * 60_000
  });
}

export function suggestionsQueryOptions(query: string) {
  return queryOptions({
    queryKey: ["books", "suggestions", query],
    queryFn: () => getSuggestions(query),
    enabled: Boolean(query.trim()),
    staleTime: 60_000
  });
}

export function bookDetailQueryOptions(workId: string) {
  return queryOptions({
    queryKey: ["books", "detail", workId],
    queryFn: () => getBookDetail(workId),
    enabled: Boolean(workId)
  });
}
