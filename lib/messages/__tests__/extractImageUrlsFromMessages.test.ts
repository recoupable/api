import { describe, it, expect } from "vitest";
import { extractImageUrlsFromMessages } from "../extractImageUrlsFromMessages";
import { UIMessage } from "ai";

describe("extractImageUrlsFromMessages", () => {
  describe("basic functionality", () => {
    it("returns empty array for empty messages", () => {
      const result = extractImageUrlsFromMessages([]);
      expect(result).toEqual([]);
    });

    it("returns empty array for messages without parts", () => {
      const messages: UIMessage[] = [
        { id: "1", role: "user", content: "Hello" } as UIMessage,
      ];
      const result = extractImageUrlsFromMessages(messages);
      expect(result).toEqual([]);
    });

    it("extracts image URLs from file parts", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "Check this image",
          parts: [
            { type: "file", mediaType: "image/png", url: "https://example.com/image.png" },
          ],
        } as UIMessage,
      ];
      const result = extractImageUrlsFromMessages(messages);
      expect(result).toEqual(["https://example.com/image.png"]);
    });

    it("extracts multiple image URLs from multiple messages", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "Image 1",
          parts: [
            { type: "file", mediaType: "image/png", url: "https://example.com/1.png" },
          ],
        } as UIMessage,
        {
          id: "2",
          role: "user",
          content: "Image 2",
          parts: [
            { type: "file", mediaType: "image/jpeg", url: "https://example.com/2.jpg" },
          ],
        } as UIMessage,
      ];
      const result = extractImageUrlsFromMessages(messages);
      expect(result).toEqual(["https://example.com/1.png", "https://example.com/2.jpg"]);
    });

    it("extracts multiple image URLs from same message", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "Multiple images",
          parts: [
            { type: "file", mediaType: "image/png", url: "https://example.com/a.png" },
            { type: "file", mediaType: "image/gif", url: "https://example.com/b.gif" },
          ],
        } as UIMessage,
      ];
      const result = extractImageUrlsFromMessages(messages);
      expect(result).toEqual(["https://example.com/a.png", "https://example.com/b.gif"]);
    });
  });

  describe("media type filtering", () => {
    it("includes image/png files", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "",
          parts: [{ type: "file", mediaType: "image/png", url: "https://example.com/test.png" }],
        } as UIMessage,
      ];
      expect(extractImageUrlsFromMessages(messages)).toHaveLength(1);
    });

    it("includes image/jpeg files", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "",
          parts: [{ type: "file", mediaType: "image/jpeg", url: "https://example.com/test.jpg" }],
        } as UIMessage,
      ];
      expect(extractImageUrlsFromMessages(messages)).toHaveLength(1);
    });

    it("includes image/gif files", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "",
          parts: [{ type: "file", mediaType: "image/gif", url: "https://example.com/test.gif" }],
        } as UIMessage,
      ];
      expect(extractImageUrlsFromMessages(messages)).toHaveLength(1);
    });

    it("includes image/webp files", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "",
          parts: [{ type: "file", mediaType: "image/webp", url: "https://example.com/test.webp" }],
        } as UIMessage,
      ];
      expect(extractImageUrlsFromMessages(messages)).toHaveLength(1);
    });

    it("excludes non-image files (application/pdf)", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "",
          parts: [
            { type: "file", mediaType: "application/pdf", url: "https://example.com/doc.pdf" },
          ],
        } as UIMessage,
      ];
      expect(extractImageUrlsFromMessages(messages)).toEqual([]);
    });

    it("excludes audio files", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "",
          parts: [{ type: "file", mediaType: "audio/mp3", url: "https://example.com/song.mp3" }],
        } as UIMessage,
      ];
      expect(extractImageUrlsFromMessages(messages)).toEqual([]);
    });

    it("excludes video files", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "",
          parts: [{ type: "file", mediaType: "video/mp4", url: "https://example.com/video.mp4" }],
        } as UIMessage,
      ];
      expect(extractImageUrlsFromMessages(messages)).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("ignores parts without mediaType", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "",
          parts: [{ type: "file", url: "https://example.com/test.png" }],
        } as UIMessage,
      ];
      expect(extractImageUrlsFromMessages(messages)).toEqual([]);
    });

    it("ignores parts without url", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "",
          parts: [{ type: "file", mediaType: "image/png" }],
        } as UIMessage,
      ];
      expect(extractImageUrlsFromMessages(messages)).toEqual([]);
    });

    it("ignores parts with empty url", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "",
          parts: [{ type: "file", mediaType: "image/png", url: "" }],
        } as UIMessage,
      ];
      expect(extractImageUrlsFromMessages(messages)).toEqual([]);
    });

    it("ignores parts with whitespace-only url", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "",
          parts: [{ type: "file", mediaType: "image/png", url: "   " }],
        } as UIMessage,
      ];
      expect(extractImageUrlsFromMessages(messages)).toEqual([]);
    });

    it("ignores non-file type parts", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "",
          parts: [
            { type: "text", text: "hello" },
            { type: "file", mediaType: "image/png", url: "https://example.com/valid.png" },
          ],
        } as UIMessage,
      ];
      const result = extractImageUrlsFromMessages(messages);
      expect(result).toEqual(["https://example.com/valid.png"]);
    });

    it("handles mixed valid and invalid parts", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "",
          parts: [
            { type: "file", mediaType: "image/png", url: "https://example.com/valid.png" },
            { type: "file", mediaType: "application/pdf", url: "https://example.com/doc.pdf" },
            { type: "file", mediaType: "image/jpeg", url: "" },
            { type: "file", mediaType: "image/gif", url: "https://example.com/valid.gif" },
          ],
        } as UIMessage,
      ];
      const result = extractImageUrlsFromMessages(messages);
      expect(result).toEqual([
        "https://example.com/valid.png",
        "https://example.com/valid.gif",
      ]);
    });
  });
});
