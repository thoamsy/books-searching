import { queryOptions } from "@tanstack/react-query";
import { getCelebrityDetail, getCelebrityWorks } from "@/lib/movies-api";

export function celebrityDetailQueryOptions(celebrityId: string) {
  return queryOptions({
    queryKey: ["celebrity", "detail", celebrityId],
    queryFn: () => getCelebrityDetail(celebrityId),
    enabled: Boolean(celebrityId)
  });
}

export function celebrityWorksQueryOptions(celebrityId: string) {
  return queryOptions({
    queryKey: ["celebrity", "works", celebrityId],
    queryFn: () => getCelebrityWorks(celebrityId),
    enabled: Boolean(celebrityId)
  });
}
