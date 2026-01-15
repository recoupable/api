import { describe, it, expect } from "vitest";
import { UIMessage } from "ai";
import getLatestUserMessageText from "../getLatestUserMessageText";

describe("getLatestUserMessageText", () => {
  describe("basic functionality", () => {
    it("returns text from a single user message", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "Hello world",
          parts: [{ type: "text", text: "Hello world" }],
        },
      ];

      const result = getLatestUserMessageText(messages);

      expect(result).toBe("Hello world");
    });

    it("returns text from the latest user message when multiple exist", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "First message",
          parts: [{ type: "text", text: "First message" }],
        },
        {
          id: "2",
          role: "assistant",
          content: "Response",
          parts: [{ type: "text", text: "Response" }],
        },
        {
          id: "3",
          role: "user",
          content: "Second message",
          parts: [{ type: "text", text: "Second message" }],
        },
      ];

      const result = getLatestUserMessageText(messages);

      expect(result).toBe("Second message");
    });
  });

  describe("edge cases", () => {
    it("returns empty string for empty messages array", () => {
      const messages: UIMessage[] = [];

      const result = getLatestUserMessageText(messages);

      expect(result).toBe("");
    });

    it("returns empty string when no user messages exist", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "assistant",
          content: "Response",
          parts: [{ type: "text", text: "Response" }],
        },
        {
          id: "2",
          role: "system",
          content: "System message",
          parts: [{ type: "text", text: "System message" }],
        },
      ];

      const result = getLatestUserMessageText(messages);

      expect(result).toBe("");
    });

    it("returns empty string when user message has no parts", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "Hello",
        } as UIMessage,
      ];

      const result = getLatestUserMessageText(messages);

      expect(result).toBe("");
    });

    it("returns empty string when user message has empty parts array", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "Hello",
          parts: [],
        },
      ];

      const result = getLatestUserMessageText(messages);

      expect(result).toBe("");
    });

    it("returns empty string when user message has no text part", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "Hello",
          parts: [
            { type: "file", mediaType: "image/png", url: "https://example.com/image.png" },
          ],
        },
      ];

      const result = getLatestUserMessageText(messages);

      expect(result).toBe("");
    });
  });

  describe("mixed content", () => {
    it("extracts text from message with both text and file parts", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "Check this image",
          parts: [
            { type: "file", mediaType: "image/png", url: "https://example.com/image.png" },
            { type: "text", text: "Check this image" },
          ],
        },
      ];

      const result = getLatestUserMessageText(messages);

      expect(result).toBe("Check this image");
    });

    it("returns first text part when multiple text parts exist", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "First text Second text",
          parts: [
            { type: "text", text: "First text" },
            { type: "text", text: "Second text" },
          ],
        },
      ];

      const result = getLatestUserMessageText(messages);

      expect(result).toBe("First text");
    });
  });

  describe("role filtering", () => {
    it("ignores assistant messages", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "User message",
          parts: [{ type: "text", text: "User message" }],
        },
        {
          id: "2",
          role: "assistant",
          content: "Latest but assistant",
          parts: [{ type: "text", text: "Latest but assistant" }],
        },
      ];

      const result = getLatestUserMessageText(messages);

      expect(result).toBe("User message");
    });

    it("ignores system messages", () => {
      const messages: UIMessage[] = [
        {
          id: "1",
          role: "user",
          content: "User message",
          parts: [{ type: "text", text: "User message" }],
        },
        {
          id: "2",
          role: "system",
          content: "System message",
          parts: [{ type: "text", text: "System message" }],
        },
      ];

      const result = getLatestUserMessageText(messages);

      expect(result).toBe("User message");
    });
  });
});
