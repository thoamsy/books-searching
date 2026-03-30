# Movie/TV Search Integration Design

## Goal

Extend the existing book search app to support Douban movie and TV show search, with unified search experience and basic info display (title, rating, poster, year, director, cast).

## API Endpoints

Movie endpoints mirror the existing book endpoints:

| Function | Book (existing) | Movie (new) |
|---|---|---|
| Suggest | `book.douban.com/j/subject_suggest` | `movie.douban.com/j/subject_suggest` |
| Search | `douban.com/search?cat=1001` | `douban.com/search?cat=1002` |
| Detail | `book.douban.com/subject/{id}` | `movie.douban.com/subject/{id}` |
| Image | `doubanio.com` (shared) | Same, reuse existing proxy |

### Suggest Response Format

```json
[{
  "id": "1292052",
  "title": "肖申克的救赎",
  "sub_title": "The Shawshank Redemption",
  "type": "movie",
  "year": "1994",
  "img": "https://img2.doubanio.com/.../p480747492.webp",
  "url": "https://movie.douban.com/subject/1292052/",
  "episode": ""
}]
```

- `type` field: `"movie"` for films, `"tv"` for TV shows
- `episode` field: empty for movies, episode count for TV

### Search Page HTML (`cat=1002`)

Returns HTML similar to book search. Needs DOM parsing to extract: title, rating, poster thumbnail, year, director, cast.

### Detail Page HTML

Movie detail pages (`movie.douban.com/subject/{id}/`) contain an `#info` div with structured metadata: director, cast, genre, release date, runtime, rating, etc. Parsing logic is different from books and needs its own implementation.

## Architecture

### Approach: Minimal Extension (No Refactor)

Reuse the existing proxy/cache/image infrastructure. Add movie-specific code in parallel to book code.

### Worker Proxy (worker/index.ts)

Add 3 new routes:

- `GET /api/douban/movie/suggest?q=` -> `movie.douban.com/j/subject_suggest`
- `GET /api/douban/movie/search?q=` -> `douban.com/search?cat=1002`
- `GET /api/douban/movie/:id` -> `movie.douban.com/subject/{id}/`

Cache TTLs same as book equivalents. Image proxy is shared, no changes needed.

### Vite Dev Proxy (vite.config.ts)

Mirror the same 3 routes with matching proxy targets.

### API Layer

New file: `src/lib/movies-api.ts`

- `getMovieSuggestions(query)` - typeahead, returns JSON
- `searchMovies(query, limit)` - search with HTML parsing
- `getMovieDetail(id)` - detail page HTML parsing

Reuse: rate-limit detection, image proxification, error handling patterns from `books-api.ts`.

### Types

New file: `src/types/movies.ts`

```typescript
interface SearchMovie {
  key: string;           // Douban subject ID
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
  externalUrl?: string;
}

interface MovieDetail {
  key: string;
  title: string;
  originalTitle?: string;
  coverUrl?: string;
  year?: string;
  description?: string;
  director?: string[];
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
  infoLink?: string;
}
```

### Query Layer

New file: `src/lib/movie-queries.ts`

- `movieSuggestionsQueryOptions(query)` - staleTime: 1 min
- `searchMoviesQueryOptions(query)` - staleTime: 5 min
- `movieDetailQueryOptions(id)` - default staleTime

### UI Changes

**Search Page (`search-page.tsx`)**:
- Unified search box, shared between books and movies
- Suggest dropdown shows both book and movie results, distinguished by icon/badge
- Search results show mixed cards: book cards (existing) + movie cards (new, with poster/director/cast)

**New Route: `/movie/:id`** (`movie-detail-page.tsx`):
- Movie detail page with poster, rating, description, director, cast, genre, metadata
- Layout similar to book detail page, adapted for movie fields

**Routing (`router.tsx`)**:
- Add `/movie/:id` route

### Local Storage

Extend search history to include movie entries (distinguish by type field).

## Out of Scope (V1)

- Director/actor pages (like author pages for books) - revisit if there's demand
- Advanced filtering (by genre, year, etc.)
- Recommendations
- Music/podcast integration

## Risks

- **HTML parsing fragility**: Movie detail page structure differs from books; need to inspect actual HTML and write dedicated parsers. Douban may change HTML structure without notice.
- **Rate limiting**: Adding movie requests doubles API traffic. Existing rate-limit detection should handle this, but monitor.
- **Search result mixing**: Need to decide ordering strategy for mixed results (suggest API returns typed results, so we can interleave).

## Estimated Scope

~500-800 lines of new code across ~6 files. No refactoring of existing book code required.
