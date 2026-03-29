import { describe, expect, it } from "vitest";
import { getMovieSuggestions, searchMovies, getMovieDetail } from "./movies-api";

describe("movies-api integration", () => {
  describe("getMovieSuggestions", () => {
    it("returns an array of suggestions for a valid query", async () => {
      const items = await getMovieSuggestions("肖申克");

      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);

      const first = items[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("title");
      expect(first).toHaveProperty("type");
      expect(["movie", "tv"]).toContain(first.type);
    });

    it("returns empty array for nonsense query", async () => {
      const items = await getMovieSuggestions("zzzxxqqnonexistent999");
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe("searchMovies", () => {
    // Douban movie search now uses client-side rendering (JS loads results).
    // HTML parsing cannot extract results. Book search still uses server-rendered HTML.
    it.skip("returns search results with expected shape", async () => {
      const result = await searchMovies("霸王别姬");

      expect(result).toHaveProperty("numFound");
      expect(result).toHaveProperty("docs");
      expect(result.numFound).toBeGreaterThan(0);
      expect(result.docs.length).toBeGreaterThan(0);
    });

    it("returns valid response shape even with empty results", async () => {
      const result = await searchMovies("电影", 3);
      expect(result).toHaveProperty("numFound");
      expect(result).toHaveProperty("docs");
      expect(Array.isArray(result.docs)).toBe(true);
      expect(result.docs.length).toBeLessThanOrEqual(3);
    });
  });

  describe("getMovieDetail", () => {
    it("returns movie detail for a known subject id", async () => {
      // 肖申克的救赎 - The Shawshank Redemption (via Frodo JSON API)
      const detail = await getMovieDetail("1292052");

      expect(detail.key).toBe("1292052");
      expect(detail.title).toBeTruthy();
      expect(detail.director).toBeInstanceOf(Array);
      expect(detail.director!.length).toBeGreaterThan(0);
      expect(detail.cast).toBeInstanceOf(Array);
      expect(detail.cast!.length).toBeGreaterThan(0);
      expect(detail.description).toBeTruthy();
      expect(detail.genre).toBeInstanceOf(Array);
      expect(detail.ratingsAverage).toBeGreaterThan(0);
      expect(detail.infoLink).toContain("1292052");
    });

    it("throws on non-existent subject id", async () => {
      await expect(getMovieDetail("0000000000")).rejects.toThrow();
    });
  });
});
