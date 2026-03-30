export interface HonorInfo {
  title: string;
  rank: number;
  kind: string;
}

export interface SearchMovie {
  key: string;
  title: string;
  originalTitle?: string;
  coverUrl?: string;
  year?: string;
  ratingsAverage?: number;
  ratingsCount?: number;
  director?: string[];
  cast?: string[];
  genre?: string[];
  type: "movie" | "tv";
  episode?: string;
  description?: string;
  externalUrl?: string;
}

export interface MovieSearchResponse {
  numFound: number;
  docs: SearchMovie[];
}

export interface MovieSuggestItem {
  type: "movie" | "tv" | "celebrity";
  id: string;
  title: string;
  url: string;
  coverUrl?: string;
  subTitle?: string;
  year?: string;
  episode?: string;
}

export interface CreditPerson {
  name: string;
  id?: string;
  character?: string;
}

export interface MovieDetail {
  key: string;
  title: string;
  originalTitle?: string;
  coverUrl?: string;
  year?: string;
  description?: string;
  director?: CreditPerson[];
  screenwriter?: CreditPerson[];
  cast?: CreditPerson[];
  genre?: string[];
  country?: string[];
  language?: string[];
  releaseDate?: string;
  runtime?: string;
  ratingsAverage?: number;
  ratingsCount?: number;
  type: "movie" | "tv";
  episode?: string;
  imdbId?: string;
  subjects?: string[];
  infoLink?: string;
  honorInfos?: HonorInfo[];
  coverLargeUrl?: string;
}

export interface CelebrityDetail {
  id: string;
  name: string;
  latinName?: string;
  coverUrl?: string;
  roles?: string;
  gender?: string;
  birthDate?: string;
  birthPlace?: string;
  imdbId?: string;
  doubanUrl?: string;
}

export interface CelebrityWork {
  id: string;
  title: string;
  coverUrl?: string;
  year?: string;
  type: "movie" | "tv";
  ratingsAverage?: number;
  roles: string[];
  genres?: string[];
}
