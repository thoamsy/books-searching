import type {
  CollectionItem,
  CollectionItemsResponse,
  CollectionMeta
} from "@/types/collection";
import { proxifyImageUrl, fetchProxy } from "@/lib/douban-shared";

interface RexxarCollectionMeta {
  id: string;
  name: string;
  title: string;
  subtitle?: string;
  subject_type?: string;
  total?: number;
  followers_count?: number;
  updated_at?: string;
  background_color_scheme?: {
    is_dark?: boolean;
    primary_color_light?: string;
    primary_color_dark?: string;
  };
}

interface RexxarCollectionItem {
  id: string;
  title: string;
  type: string;
  rank?: number;
  rank_value?: number;
  rating?: { value?: number; count?: number };
  pic?: { large?: string; normal?: string };
  cover?: { url?: string };
  card_subtitle?: string;
  info?: string;
  year?: string;
  honor_infos?: { rank: number; title: string }[];
}

interface RexxarItemsResponse {
  total: number;
  start: number;
  count: number;
  subject_collection: RexxarCollectionMeta;
  subject_collection_items: RexxarCollectionItem[];
}

function mapMeta(raw: RexxarCollectionMeta): CollectionMeta {
  return {
    id: raw.id,
    name: raw.name,
    title: raw.title,
    subtitle: raw.subtitle,
    subjectType: (raw.subject_type as CollectionMeta["subjectType"]) ?? "book",
    total: raw.total ?? 0,
    followersCount: raw.followers_count,
    updatedAt: raw.updated_at,
    backgroundColorScheme: raw.background_color_scheme
      ? {
          isDark: raw.background_color_scheme.is_dark ?? false,
          primaryColorLight: raw.background_color_scheme.primary_color_light,
          primaryColorDark: raw.background_color_scheme.primary_color_dark
        }
      : undefined
  };
}

function mapItem(raw: RexxarCollectionItem): CollectionItem {
  const coverUrl = raw.pic?.large ?? raw.pic?.normal ?? raw.cover?.url;
  return {
    id: raw.id,
    title: raw.title,
    type: (raw.type as CollectionItem["type"]) ?? "book",
    rank: raw.rank ?? raw.rank_value,
    coverUrl: proxifyImageUrl(coverUrl),
    rating:
      raw.rating?.value != null
        ? { value: raw.rating.value, count: raw.rating.count ?? 0 }
        : undefined,
    cardSubtitle: raw.card_subtitle,
    info: raw.info,
    year: raw.year,
    honorInfos: raw.honor_infos
  };
}

export async function getCollectionItems(
  collectionId: string,
  start = 0,
  count = 20
): Promise<CollectionItemsResponse> {
  const response = await fetchProxy(
    `/api/douban/collection/${collectionId}/items?start=${start}&count=${count}`,
    "application/json"
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch collection items (${response.status})`);
  }
  const data: RexxarItemsResponse = await response.json();
  return {
    total: data.total,
    start: data.start,
    count: data.count,
    meta: mapMeta(data.subject_collection),
    items: (data.subject_collection_items ?? []).map(mapItem)
  };
}
