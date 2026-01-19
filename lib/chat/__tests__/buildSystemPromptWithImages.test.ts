import { describe, it, expect } from "vitest";
import { buildSystemPromptWithImages } from "../buildSystemPromptWithImages";

describe("buildSystemPromptWithImages", () => {
  describe("basic functionality", () => {
    it("returns base prompt unchanged when no image URLs", () => {
      const basePrompt = "You are a helpful assistant.";
      const result = buildSystemPromptWithImages(basePrompt, []);
      expect(result).toBe(basePrompt);
    });

    it("appends image URLs section when images provided", () => {
      const basePrompt = "You are a helpful assistant.";
      const imageUrls = ["https://example.com/image.png"];
      const result = buildSystemPromptWithImages(basePrompt, imageUrls);

      expect(result).toContain(basePrompt);
      expect(result).toContain("**ATTACHED IMAGE URLS");
      expect(result).toContain("https://example.com/image.png");
    });

    it("formats multiple images with index numbers", () => {
      const basePrompt = "Base prompt";
      const imageUrls = [
        "https://example.com/1.png",
        "https://example.com/2.jpg",
        "https://example.com/3.gif",
      ];
      const result = buildSystemPromptWithImages(basePrompt, imageUrls);

      expect(result).toContain("- Image 0: https://example.com/1.png");
      expect(result).toContain("- Image 1: https://example.com/2.jpg");
      expect(result).toContain("- Image 2: https://example.com/3.gif");
    });
  });

  describe("output format", () => {
    it("separates base prompt from images section with newlines", () => {
      const basePrompt = "Base prompt here";
      const imageUrls = ["https://example.com/test.png"];
      const result = buildSystemPromptWithImages(basePrompt, imageUrls);

      expect(result).toMatch(/Base prompt here\n\n\*\*ATTACHED IMAGE URLS/);
    });

    it("includes edit_image context in section header", () => {
      const basePrompt = "Base";
      const imageUrls = ["https://example.com/test.png"];
      const result = buildSystemPromptWithImages(basePrompt, imageUrls);

      expect(result).toContain("(for edit_image imageUrl parameter)");
    });

    it("lists each image on its own line", () => {
      const basePrompt = "Base";
      const imageUrls = ["https://example.com/a.png", "https://example.com/b.png"];
      const result = buildSystemPromptWithImages(basePrompt, imageUrls);

      const lines = result.split("\n");
      const imageLines = lines.filter((line) => line.startsWith("- Image"));
      expect(imageLines).toHaveLength(2);
    });
  });

  describe("edge cases", () => {
    it("handles empty base prompt", () => {
      const result = buildSystemPromptWithImages("", ["https://example.com/test.png"]);

      expect(result).toContain("**ATTACHED IMAGE URLS");
      expect(result).toContain("https://example.com/test.png");
    });

    it("handles single image", () => {
      const basePrompt = "Single image test";
      const result = buildSystemPromptWithImages(basePrompt, ["https://example.com/only.png"]);

      expect(result).toContain("- Image 0: https://example.com/only.png");
      expect(result).not.toContain("Image 1");
    });

    it("handles many images", () => {
      const basePrompt = "Many images";
      const imageUrls = Array.from({ length: 10 }, (_, i) => `https://example.com/${i}.png`);
      const result = buildSystemPromptWithImages(basePrompt, imageUrls);

      expect(result).toContain("- Image 0:");
      expect(result).toContain("- Image 9:");
    });

    it("preserves special characters in URLs", () => {
      const basePrompt = "Test";
      const imageUrls = ["https://example.com/image%20with%20spaces.png?token=abc&id=123"];
      const result = buildSystemPromptWithImages(basePrompt, imageUrls);

      expect(result).toContain("https://example.com/image%20with%20spaces.png?token=abc&id=123");
    });

    it("preserves multiline base prompts", () => {
      const basePrompt = "Line 1\nLine 2\nLine 3";
      const result = buildSystemPromptWithImages(basePrompt, ["https://example.com/test.png"]);

      expect(result).toContain("Line 1\nLine 2\nLine 3");
      expect(result).toContain("**ATTACHED IMAGE URLS");
    });
  });
});
