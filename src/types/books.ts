export interface SearchBook {
  key: string;
  title: string;
  authorName: string[];
  coverUrl?: string;
  firstPublishYear?: number;
  ratingsAverage?: number;
  ratingsCount?: number;
  pageCount?: number;
  language?: string[];
  subject?: string[];
  publisher?: string;
  description?: string;
  externalUrl?: string;
}

export interface SearchResponse {
  numFound: number;
  docs: SearchBook[];
}

export interface HonorInfo {
  title: string;
  rank: number;
  kind: string;
}

export interface SubjectCollection {
  id: string;
  title: string;
}

export interface BookDetail {
  key: string;
  title: string;
  description?: string;
  firstPublishDate?: string;
  subjects?: string[];
  coverUrl?: string;
  authors?: string[];
  publisher?: string;
  pageCount?: number;
  ratingsAverage?: number;
  ratingsCount?: number;
  infoLink?: string;
  identifiers?: string[];
  originalTitle?: string;
  subtitle?: string;
  translator?: string[];
  catalog?: string;
  honorInfos?: HonorInfo[];
  subjectCollections?: SubjectCollection[];
}

export interface SuggestItem {
  type: "book" | "author";
  id: string;
  title: string;
  url: string;
  coverUrl?: string;
  authorName?: string;
  year?: string;
  enName?: string;
}

export interface AuthorDetail {
  key: string;
  name: string;
  bio?: string | { value?: string };
  birthDate?: string;
  deathDate?: string;
}
