import { describe, it, expect } from "vitest";
import getTextContent from "../getTextContent";

describe("getTextContent", () => {
  describe("string content", () => {
    it("returns string content as-is", () => {
      expect(getTextContent("Hello world")).toBe("Hello world");
    });

    it("handles empty string", () => {
      expect(getTextContent("")).toBe("");
    });
  });

  describe("content parts array", () => {
    it("extracts text from single text part", () => {
      const content = [{ type: "text" as const, text: "Hello" }];
      expect(getTextContent(content)).toBe("Hello");
    });

    it("joins multiple text parts", () => {
      const content = [
        { type: "text" as const, text: "Hello " },
        { type: "text" as const, text: "world!" },
      ];
      expect(getTextContent(content)).toBe("Hello world!");
    });

    it("filters out non-text parts", () => {
      const content = [
        { type: "text" as const, text: "Hello" },
        { type: "image" as const, image: "data:image/png;base64,..." },
        { type: "text" as const, text: " world" },
      ] as any;
      expect(getTextContent(content)).toBe("Hello world");
    });

    it("returns empty string for empty array", () => {
      expect(getTextContent([])).toBe("");
    });

    it("returns empty string when no text parts exist", () => {
      const content = [
        { type: "image" as const, image: "data:image/png;base64,..." },
      ] as any;
      expect(getTextContent(content)).toBe("");
    });
  });
});
