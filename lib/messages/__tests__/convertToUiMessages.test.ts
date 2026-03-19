import { describe, it, expect, vi, beforeEach } from "vitest";

import convertToUiMessages from "../convertToUiMessages";

// Mock generateUUID before importing the module
vi.mock("@/lib/uuid/generateUUID", () => ({
  default: vi.fn(() => "generated-uuid"),
  generateUUID: vi.fn(() => "generated-uuid"),
}));

describe("convertToUiMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("passthrough for UIMessage format", () => {
    it("returns messages unchanged when already in UIMessage format", () => {
      const messages = [
        {
          id: "msg-1",
          role: "user" as const,
          parts: [{ type: "text" as const, text: "Hello" }],
        },
        {
          id: "msg-2",
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: "Hi there!" }],
        },
      ];

      const result = convertToUiMessages(messages);

      expect(result).toEqual(messages);
      expect(result[0].id).toBe("msg-1");
      expect(result[1].id).toBe("msg-2");
    });

    it("preserves existing message IDs", () => {
      const messages = [
        {
          id: "custom-id-123",
          role: "user" as const,
          parts: [{ type: "text" as const, text: "Test" }],
        },
      ];

      const result = convertToUiMessages(messages);

      expect(result[0].id).toBe("custom-id-123");
    });
  });

  describe("conversion from simple format", () => {
    it("converts { role, content } format to UIMessage format", () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ];

      const result = convertToUiMessages(messages);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "generated-uuid",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      });
      expect(result[1]).toEqual({
        id: "generated-uuid",
        role: "assistant",
        parts: [{ type: "text", text: "Hi there!" }],
      });
    });

    it("generates UUIDs for ModelMessage format (ModelMessage has no id field)", () => {
      const messages = [{ role: "user", content: "Hello" }];

      const result = convertToUiMessages(messages);

      expect(result[0].id).toBe("generated-uuid");
    });
  });

  describe("mixed formats", () => {
    it("handles mixed UIMessage and simple formats", () => {
      const messages = [
        {
          id: "ui-msg-1",
          role: "user" as const,
          parts: [{ type: "text" as const, text: "First message" }],
        },
        { role: "assistant", content: "Second message" },
        {
          id: "ui-msg-3",
          role: "user" as const,
          parts: [{ type: "text" as const, text: "Third message" }],
        },
      ];

      const result = convertToUiMessages(messages);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("ui-msg-1");
      expect(result[0].parts[0].text).toBe("First message");
      expect(result[1].id).toBe("generated-uuid");
      expect(result[1].parts[0].text).toBe("Second message");
      expect(result[2].id).toBe("ui-msg-3");
      expect(result[2].parts[0].text).toBe("Third message");
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty input", () => {
      const result = convertToUiMessages([]);

      expect(result).toEqual([]);
    });

    it("handles system role messages", () => {
      const messages = [{ role: "system", content: "You are a helpful assistant" }];

      const result = convertToUiMessages(messages);

      expect(result[0].role).toBe("system");
      expect(result[0].parts[0].text).toBe("You are a helpful assistant");
    });

    it("handles messages with empty content", () => {
      const messages = [{ role: "user", content: "" }];

      const result = convertToUiMessages(messages);

      expect(result[0].parts[0].text).toBe("");
    });

    it("handles ModelMessage with content parts array", () => {
      const messages = [
        {
          role: "user",
          content: [
            { type: "text" as const, text: "Hello " },
            { type: "text" as const, text: "world!" },
          ],
        },
      ];

      const result = convertToUiMessages(messages as any);

      expect(result[0].parts[0].text).toBe("Hello world!");
    });
  });
});
