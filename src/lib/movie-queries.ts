import { queryOptions } from "@tanstack/react-query";
import { getMovieDetail, getMovieSuggestions, searchMovies } from "@/lib/movies-api";

export function searchMoviesQueryOptions(query: string) {
  return queryOptions({
    queryKey: ["movies", "search", query],
    queryFn: () => searchMovies(query),
    enabled: Boolean(query.trim()),
    staleTime: 5 * 60_000
  });
}

export function movieSuggestionsQueryOptions(query: string) {
  return queryOptions({
    queryKey: ["movies", "suggestions", query],
    queryFn: () => getMovieSuggestions(query),
    enabled: Boolean(query.trim()),
    staleTime: 60_000
  });
}

export function movieDetailQueryOptions(subjectId: string) {
  return queryOptions({
    queryKey: ["movies", "detail", subjectId],
    queryFn: () => getMovieDetail(subjectId),
    enabled: Boolean(subjectId)
  });
}
