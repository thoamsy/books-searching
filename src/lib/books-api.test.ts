import { describe, expect, it } from "vitest";
import { searchBooks, getSuggestions, getBookDetail } from "./books-api";

describe("books-api integration", () => {
  describe("getSuggestions", () => {
    it("returns an array of suggestions for a valid query", async () => {
      const items = await getSuggestions("鲁迅");

      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);

      const first = items[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("title");
      expect(first).toHaveProperty("type");
      expect(["book", "author"]).toContain(first.type);
    });

    it("returns empty array for nonsense query", async () => {
      const items = await getSuggestions("zzzxxqqnonexistent999");
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe("searchBooks", () => {
    it("returns search results with expected shape", async () => {
      const result = await searchBooks("活着");

      expect(result).toHaveProperty("numFound");
      expect(result).toHaveProperty("docs");
      expect(result.numFound).toBeGreaterThan(0);
      expect(result.docs.length).toBeGreaterThan(0);

      const book = result.docs[0];
      expect(book).toHaveProperty("key");
      expect(book).toHaveProperty("title");
      expect(book.key).toBeTruthy();
      expect(book.title).toBeTruthy();
    });

    it("respects the limit parameter", async () => {
      const result = await searchBooks("小说", 3);
      expect(result.docs.length).toBeLessThanOrEqual(3);
    });
  });

  describe("getBookDetail", () => {
    it("returns book detail for a known subject id", async () => {
      // 活着 by 余华 - a well-known book on Douban (via Frodo JSON API)
      const detail = await getBookDetail("4913064");

      expect(detail.key).toBe("4913064");
      expect(detail.title).toBeTruthy();
      expect(detail.authors).toBeInstanceOf(Array);
      expect(detail.authors!.length).toBeGreaterThan(0);
      expect(detail.description).toBeTruthy();
      expect(detail.infoLink).toContain("4913064");

      // New Frodo fields
      expect(detail.honorInfos).toBeInstanceOf(Array);
      expect(detail.subjectCollections).toBeInstanceOf(Array);
      expect(detail.translator).toBeInstanceOf(Array);
      expect(typeof detail.catalog === "string" || detail.catalog === undefined).toBe(true);
    });

    it("throws on non-existent subject id", async () => {
      await expect(getBookDetail("0000000000")).rejects.toThrow();
    });
  });
});
