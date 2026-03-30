export interface CollectionMeta {
  id: string;
  name: string;
  title: string;
  subtitle?: string;
  subjectType: "book" | "movie" | "tv" | "music";
  total: number;
  followersCount?: number;
  updatedAt?: string;
  backgroundColorScheme?: {
    isDark: boolean;
    primaryColorLight?: string;
    primaryColorDark?: string;
  };
}

export interface CollectionItem {
  id: string;
  title: string;
  type: "book" | "movie" | "tv";
  rank?: number;
  coverUrl?: string;
  rating?: {
    value: number;
    count: number;
  };
  cardSubtitle?: string;
  info?: string;
  year?: string;
  honorInfos?: { rank: number; title: string }[];
}

export interface CollectionItemsResponse {
  total: number;
  start: number;
  count: number;
  meta: CollectionMeta;
  items: CollectionItem[];
}
