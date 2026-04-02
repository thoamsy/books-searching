import type { CelebrityDetail, CelebrityWork, CreditPerson, MovieDetail, MovieSearchResponse, MovieSuggestItem, SearchMovie } from "@/types/movies";
import {
  proxifyImageUrl,
  fetchProxy,
  extractCollectionId,
} from "@/lib/douban-shared";

interface DoubanMovieSuggestEntry {
  type: string;
  id: string;
  title: string;
  url: string;
  img?: string;
  sub_title?: string;
  year?: string;
  episode?: string;
}

export async function getMovieSuggestions(query: string): Promise<MovieSuggestItem[]> {
  const response = await fetchProxy(`/api/douban/movie/suggest?q=${encodeURIComponent(query)}`, "application/json");
  if (!response.ok) {
    throw new Error("Failed to fetch movie suggestions.");
  }

  const data: DoubanMovieSuggestEntry[] = await response.json();

  return data.map((entry) => ({
    type: entry.type === "celebrity" ? "celebrity" : entry.episode ? "tv" : "movie",
    id: entry.id,
    title: entry.title,
    url: entry.url,
    coverUrl: proxifyImageUrl(entry.img),
    subTitle: entry.sub_title,
    year: entry.year,
    episode: entry.episode
  }));
}

interface FrodoSearchTarget {
  id: string;
  title: string;
  rating?: { value?: number; count?: number };
  cover_url?: string;
  card_subtitle?: string;
  year?: string;
}

interface FrodoSearchResponse {
  subjects: {
    total: number;
    start: number;
    count: number;
    items: {
      target_id: string;
      target_type: string;
      target: FrodoSearchTarget;
    }[];
  };
}

function parseMovieCardSubtitle(subtitle?: string) {
  if (!subtitle) return { director: [], cast: [] };
  const parts = subtitle.split("/").map((s) => s.trim()).filter(Boolean);
  // Format: "country / genre1 genre2 / director / actor1 actor2"
  if (parts.length >= 4) {
    return {
      director: parts[2] ? [parts[2]] : [],
      cast: parts.slice(3),
    };
  }
  return { director: [], cast: [] };
}

export async function searchMovies(query: string, limit = 18): Promise<MovieSearchResponse> {
  const response = await fetchProxy(
    `/api/douban/search/subjects?type=movie&q=${encodeURIComponent(query)}&count=${limit}`,
    "application/json"
  );
  if (!response.ok) {
    throw new Error("Failed to search movies.");
  }

  const data: FrodoSearchResponse = await response.json();
  const items = data.subjects?.items ?? [];

  const docs: SearchMovie[] = items.map((item) => {
    const t = item.target;
    const parsed = parseMovieCardSubtitle(t.card_subtitle);
    return {
      key: item.target_id,
      title: t.title || "未知影片",
      coverUrl: proxifyImageUrl(t.cover_url),
      year: t.year?.match(/\d{4}/)?.[0],
      ratingsAverage: t.rating?.value || undefined,
      ratingsCount: t.rating?.count || undefined,
      director: parsed.director,
      cast: parsed.cast,
      type: item.target_type === "tv" ? "tv" : "movie",
      externalUrl: `https://movie.douban.com/subject/${item.target_id}/`,
    };
  });

  return { numFound: data.subjects?.total ?? docs.length, docs };
}

interface FrodoMovieResponse {
  id: string;
  title: string;
  original_title?: string;
  year?: string;
  intro?: string;
  pic?: { large?: string; normal?: string };
  cover_url?: string;
  rating?: { value?: number; count?: number };
  directors?: { name: string }[];
  actors?: { name: string }[];
  writers?: { name: string }[];
  genres?: string[];
  countries?: string[];
  languages?: string[];
  durations?: string[];
  pubdate?: string[];
  episodes_count?: number;
  type?: string;
  subtype?: string;
  tags?: { name: string }[];
  aka?: string[];
  honor_infos?: { title: string; rank: number; kind: string; uri?: string }[];
  subject_collections?: { id: string; title: string; uri?: string }[];
  cover?: { image?: { large?: { url: string } } };
}

interface FrodoCreditsResponse {
  items: {
    category: string;
    name: string;
    url?: string;
    simple_character?: string;
  }[];
}

function extractCelebrityId(url?: string) {
  return url?.match(/celebrity\/(\d+)/)?.[1];
}

async function fetchCredits(subjectId: string): Promise<Map<string, CreditPerson>> {
  try {
    const response = await fetchProxy(`/api/douban/movie/${subjectId}/credits`, "application/json");
    if (!response.ok) return new Map();
    const data: FrodoCreditsResponse = await response.json();
    const map = new Map<string, CreditPerson>();
    for (const item of data.items) {
      if (!map.has(item.name)) {
        map.set(item.name, {
          name: item.name,
          id: extractCelebrityId(item.url),
          character: item.simple_character
        });
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function getMovieDetail(subjectId: string): Promise<MovieDetail> {
  const [response, creditsMap] = await Promise.all([
    fetchProxy(`/api/douban/movie/${subjectId}/`, "application/json"),
    fetchCredits(subjectId)
  ]);

  if (!response.ok) {
    throw new Error("Failed to fetch movie details.");
  }

  const data: FrodoMovieResponse = await response.json();

  const isTV = data.subtype === "tv" || (data.episodes_count ?? 0) > 0;

  const toPerson = (name: string): CreditPerson =>
    creditsMap.get(name) ?? { name };

  return {
    key: subjectId,
    title: data.title || "未知影片",
    originalTitle: data.original_title || data.aka?.[0],
    description: data.intro,
    director: data.directors?.map((d) => toPerson(d.name)) ?? [],
    screenwriter: data.writers?.map((w) => toPerson(w.name)) ?? [],
    cast: data.actors?.map((a) => toPerson(a.name)) ?? [],
    genre: data.genres ?? [],
    country: data.countries ?? [],
    language: data.languages ?? [],
    releaseDate: data.pubdate?.[0],
    runtime: data.durations?.[0],
    year: data.year,
    ratingsAverage: data.rating?.value,
    ratingsCount: data.rating?.count,
    type: isTV ? "tv" : "movie",
    episode: isTV && data.episodes_count ? String(data.episodes_count) : undefined,
    subjects: data.tags?.map((t) => t.name) ?? [],
    coverUrl: proxifyImageUrl(data.cover?.image?.large?.url ?? data.pic?.large ?? data.cover_url),
    coverLargeUrl: proxifyImageUrl(data.cover?.image?.large?.url),
    honorInfos: data.honor_infos?.map((h) => ({
      title: h.title,
      rank: h.rank,
      kind: h.kind,
      collectionId: extractCollectionId(h.uri)
    })),
    subjectCollections: data.subject_collections?.map((c) => ({ id: c.id, title: c.title })),
    infoLink: `https://movie.douban.com/subject/${subjectId}/`
  };
}

export function suggestItemToSearchMovie(item: MovieSuggestItem): SearchMovie {
  return {
    key: item.id,
    title: item.title,
    originalTitle: item.subTitle,
    coverUrl: item.coverUrl,
    year: item.year,
    type: item.type === "celebrity" ? "movie" : item.type,
    episode: item.episode,
    externalUrl: item.url
  };
}

export function getMovieCoverUrl(coverUrl?: string) {
  return coverUrl ?? null;
}

interface FrodoCelebrityResponse {
  id: string;
  title: string;
  latin_title?: string;
  cover_img?: { url?: string };
  cover?: { large?: { url?: string }; normal?: { url?: string } };
  extra?: {
    short_info?: string;
    info?: [string, string][];
  };
  url?: string;
}

interface FrodoCelebrityWorksResponse {
  total: number;
  works: {
    work: {
      id: string;
      title: string;
      year?: string;
      type?: string;
      subtype?: string;
      pic?: { large?: string; normal?: string };
      cover_url?: string;
      rating?: { value?: number };
      genres?: string[];
    };
    roles: string[];
  }[];
}

export async function getCelebrityDetail(celebrityId: string): Promise<CelebrityDetail> {
  const response = await fetchProxy(`/api/douban/celebrity/${celebrityId}/`, "application/json");
  if (!response.ok) {
    throw new Error("Failed to fetch celebrity details.");
  }

  const data: FrodoCelebrityResponse = await response.json();
  const info = data.extra?.info ?? [];
  const findInfo = (key: string) => info.find(([k]) => k === key)?.[1];

  return {
    id: celebrityId,
    name: data.title || "未知影人",
    latinName: data.latin_title,
    coverUrl: proxifyImageUrl(data.cover?.large?.url ?? data.cover_img?.url),
    roles: data.extra?.short_info,
    gender: findInfo("性别"),
    birthDate: findInfo("出生日期"),
    birthPlace: findInfo("出生地"),
    imdbId: findInfo("IMDb编号"),
    doubanUrl: data.url
  };
}

export async function getCelebrityWorks(celebrityId: string): Promise<CelebrityWork[]> {
  const response = await fetchProxy(`/api/douban/celebrity/${celebrityId}/works`, "application/json");
  if (!response.ok) {
    throw new Error("Failed to fetch celebrity works.");
  }

  const data: FrodoCelebrityWorksResponse = await response.json();

  return data.works.map((entry) => ({
    id: entry.work.id,
    title: entry.work.title,
    coverUrl: proxifyImageUrl(entry.work.pic?.large ?? entry.work.cover_url),
    year: entry.work.year,
    type: entry.work.subtype === "tv" ? "tv" : "movie",
    ratingsAverage: entry.work.rating?.value,
    roles: entry.roles,
    genres: entry.work.genres
  }));
}
