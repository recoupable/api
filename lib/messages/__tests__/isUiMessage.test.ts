import { describe, it, expect } from "vitest";
import isUiMessage from "../isUiMessage";

describe("isUiMessage", () => {
  describe("returns true for UIMessage format", () => {
    it("identifies message with parts array as UIMessage", () => {
      const message = {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      };

      expect(isUiMessage(message)).toBe(true);
    });

    it("identifies message with empty parts array as UIMessage", () => {
      const message = {
        id: "msg-1",
        role: "user",
        parts: [],
      };

      expect(isUiMessage(message)).toBe(true);
    });

    it("identifies assistant message as UIMessage", () => {
      const message = {
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", text: "Hi there!" }],
      };

      expect(isUiMessage(message)).toBe(true);
    });
  });

  describe("returns false for simple format", () => {
    it("identifies message with content string as non-UIMessage", () => {
      const message = {
        role: "user",
        content: "Hello",
      };

      expect(isUiMessage(message)).toBe(false);
    });

    it("identifies message with id and content as non-UIMessage", () => {
      const message = {
        id: "msg-1",
        role: "user",
        content: "Hello",
      };

      expect(isUiMessage(message)).toBe(false);
    });
  });

  describe("handles edge cases", () => {
    it("returns false for null", () => {
      expect(isUiMessage(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isUiMessage(undefined)).toBe(false);
    });

    it("returns false for primitive values", () => {
      expect(isUiMessage("string")).toBe(false);
      expect(isUiMessage(123)).toBe(false);
      expect(isUiMessage(true)).toBe(false);
    });

    it("returns false for empty object", () => {
      expect(isUiMessage({})).toBe(false);
    });

    it("returns false when parts is not an array", () => {
      const message = {
        id: "msg-1",
        role: "user",
        parts: "not an array",
      };

      expect(isUiMessage(message)).toBe(false);
    });
  });
});
