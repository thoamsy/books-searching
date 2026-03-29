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
  type: "movie" | "tv";
  id: string;
  title: string;
  url: string;
  coverUrl?: string;
  subTitle?: string;
  year?: string;
  episode?: string;
}

export interface MovieDetail {
  key: string;
  title: string;
  originalTitle?: string;
  coverUrl?: string;
  year?: string;
  description?: string;
  director?: string[];
  screenwriter?: string[];
  cast?: string[];
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
}
