import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getKnowledgeBaseText } from "../getKnowledgeBaseText";

describe("getKnowledgeBaseText", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe("input validation", () => {
    it("returns undefined for null input", async () => {
      const result = await getKnowledgeBaseText(null);
      expect(result).toBeUndefined();
    });

    it("returns undefined for undefined input", async () => {
      const result = await getKnowledgeBaseText(undefined);
      expect(result).toBeUndefined();
    });

    it("returns undefined for empty array", async () => {
      const result = await getKnowledgeBaseText([]);
      expect(result).toBeUndefined();
    });

    it("returns undefined for non-array input", async () => {
      const result = await getKnowledgeBaseText("not an array");
      expect(result).toBeUndefined();
    });

    it("returns undefined for object input", async () => {
      const result = await getKnowledgeBaseText({ key: "value" });
      expect(result).toBeUndefined();
    });
  });

  describe("file type filtering", () => {
    it("includes text/plain files", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("Plain text content"),
      } as Response);

      const knowledges = [
        { name: "notes.txt", url: "https://example.com/notes.txt", type: "text/plain" },
      ];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toContain("Plain text content");
    });

    it("includes text/markdown files", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("# Markdown heading"),
      } as Response);

      const knowledges = [
        { name: "readme.md", url: "https://example.com/readme.md", type: "text/markdown" },
      ];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toContain("# Markdown heading");
    });

    it("includes application/json files", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"key": "value"}'),
      } as Response);

      const knowledges = [
        { name: "config.json", url: "https://example.com/config.json", type: "application/json" },
      ];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toContain('{"key": "value"}');
    });

    it("includes text/csv files", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("name,email\nJohn,john@example.com"),
      } as Response);

      const knowledges = [
        { name: "data.csv", url: "https://example.com/data.csv", type: "text/csv" },
      ];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toContain("name,email");
    });

    it("excludes image files", async () => {
      const knowledges = [
        { name: "photo.jpg", url: "https://example.com/photo.jpg", type: "image/jpeg" },
      ];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toBeUndefined();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("excludes PDF files", async () => {
      const knowledges = [
        { name: "doc.pdf", url: "https://example.com/doc.pdf", type: "application/pdf" },
      ];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toBeUndefined();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("excludes audio files", async () => {
      const knowledges = [
        { name: "song.mp3", url: "https://example.com/song.mp3", type: "audio/mpeg" },
      ];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toBeUndefined();
    });
  });

  describe("content fetching", () => {
    it("fetches content from URL", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("Fetched content"),
      } as Response);

      const knowledges = [
        { name: "file.txt", url: "https://example.com/file.txt", type: "text/plain" },
      ];
      await getKnowledgeBaseText(knowledges);

      expect(global.fetch).toHaveBeenCalledWith("https://example.com/file.txt");
    });

    it("handles failed fetch gracefully", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(""),
      } as Response);

      const knowledges = [
        { name: "missing.txt", url: "https://example.com/missing.txt", type: "text/plain" },
      ];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toBeUndefined();
    });

    it("handles fetch errors gracefully", async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

      const knowledges = [
        { name: "file.txt", url: "https://example.com/file.txt", type: "text/plain" },
      ];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toBeUndefined();
    });
  });

  describe("content formatting", () => {
    it("prefixes content with file name header", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("File content"),
      } as Response);

      const knowledges = [
        { name: "myfile.txt", url: "https://example.com/myfile.txt", type: "text/plain" },
      ];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toContain("--- myfile.txt ---");
      expect(result).toContain("File content");
    });

    it("uses Unknown for missing file name", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("Content"),
      } as Response);

      const knowledges = [{ url: "https://example.com/file.txt", type: "text/plain" }];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toContain("--- Unknown ---");
    });

    it("combines multiple files with double newlines", async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve("Content A"),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve("Content B"),
        } as Response);

      const knowledges = [
        { name: "a.txt", url: "https://example.com/a.txt", type: "text/plain" },
        { name: "b.txt", url: "https://example.com/b.txt", type: "text/plain" },
      ];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toContain("--- a.txt ---");
      expect(result).toContain("--- b.txt ---");
      expect(result).toContain("Content A");
      expect(result).toContain("Content B");
    });
  });

  describe("edge cases", () => {
    it("filters out files without URL", async () => {
      const knowledges = [{ name: "no-url.txt", type: "text/plain" }];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toBeUndefined();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("filters out files without type", async () => {
      const knowledges = [{ name: "no-type.txt", url: "https://example.com/no-type.txt" }];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toBeUndefined();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("handles mix of valid and invalid files", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("Valid content"),
      } as Response);

      const knowledges = [
        { name: "valid.txt", url: "https://example.com/valid.txt", type: "text/plain" },
        { name: "image.jpg", url: "https://example.com/image.jpg", type: "image/jpeg" },
        { name: "no-url.txt", type: "text/plain" },
      ];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toContain("Valid content");
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("returns undefined when all fetches fail", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(""),
      } as Response);

      const knowledges = [
        { name: "a.txt", url: "https://example.com/a.txt", type: "text/plain" },
        { name: "b.txt", url: "https://example.com/b.txt", type: "text/plain" },
      ];
      const result = await getKnowledgeBaseText(knowledges);

      expect(result).toBeUndefined();
    });
  });
});
