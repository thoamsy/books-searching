// src/lib/douban-shared.test.ts
import { describe, expect, it } from "vitest";
import {
  normalizeUrl,
  proxifyImageUrl,
  extractCollectionId,
} from "./douban-shared";

describe("douban-shared", () => {
  describe("normalizeUrl", () => {
    it("prepends https to protocol-relative URLs", () => {
      expect(normalizeUrl("//img.doubanio.com/pic.jpg")).toBe("https://img.doubanio.com/pic.jpg");
    });

    it("converts http to https", () => {
      expect(normalizeUrl("http://example.com/img.jpg")).toBe("https://example.com/img.jpg");
    });

    it("returns undefined for falsy input", () => {
      expect(normalizeUrl(undefined)).toBeUndefined();
      expect(normalizeUrl(null)).toBeUndefined();
      expect(normalizeUrl("")).toBeUndefined();
    });

    it("returns https URLs unchanged", () => {
      expect(normalizeUrl("https://example.com/img.jpg")).toBe("https://example.com/img.jpg");
    });
  });

  describe("proxifyImageUrl", () => {
    it("proxifies doubanio URLs", () => {
      const result = proxifyImageUrl("https://img3.doubanio.com/pic.jpg");
      expect(result).toContain("/api/douban/image?url=");
      expect(result).toContain(encodeURIComponent("https://img3.doubanio.com/pic.jpg"));
    });

    it("returns non-doubanio URLs as-is after normalizing", () => {
      expect(proxifyImageUrl("https://other.com/pic.jpg")).toBe("https://other.com/pic.jpg");
    });

    it("returns undefined for falsy input", () => {
      expect(proxifyImageUrl(undefined)).toBeUndefined();
    });
  });

  describe("extractCollectionId", () => {
    it("extracts collection ID from douban URI", () => {
      expect(
        extractCollectionId("douban://douban.com/subject_collection/ECZZABULI?source=xxx")
      ).toBe("ECZZABULI");
    });

    it("returns undefined for falsy input", () => {
      expect(extractCollectionId(undefined)).toBeUndefined();
    });
  });
});
