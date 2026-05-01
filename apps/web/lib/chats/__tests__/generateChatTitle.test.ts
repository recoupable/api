import { describe, it, expect, vi, beforeEach } from "vitest";

import { generateChatTitle } from "../generateChatTitle";
import generateText from "@/lib/ai/generateText";

vi.mock("@/lib/ai/generateText", () => ({
  default: vi.fn(),
}));

const mockGenerateText = vi.mocked(generateText);

describe("generateChatTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("title generation", () => {
    it("generates a title from the input text", async () => {
      mockGenerateText.mockResolvedValue({
        text: "Marketing Plan",
      } as any);

      const result = await generateChatTitle("What marketing strategies should I use?");

      expect(result).toBe("Marketing Plan");
    });

    it("calls generateText with correct prompt structure", async () => {
      mockGenerateText.mockResolvedValue({
        text: "Test Title",
      } as any);

      await generateChatTitle("Test input");

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Test input"),
          model: expect.any(String),
        }),
      );
    });

    it("uses LIGHTWEIGHT_MODEL for efficiency", async () => {
      mockGenerateText.mockResolvedValue({
        text: "Test Title",
      } as any);

      await generateChatTitle("Test input");

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.stringContaining("gpt-4o-mini"),
        }),
      );
    });
  });

  describe("quote handling", () => {
    it("removes leading double quotes from generated title", async () => {
      mockGenerateText.mockResolvedValue({
        text: '"Marketing Plan',
      } as any);

      const result = await generateChatTitle("What marketing strategies?");

      expect(result).toBe("Marketing Plan");
    });

    it("removes trailing double quotes from generated title", async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Marketing Plan"',
      } as any);

      const result = await generateChatTitle("What marketing strategies?");

      expect(result).toBe("Marketing Plan");
    });

    it("removes both leading and trailing double quotes", async () => {
      mockGenerateText.mockResolvedValue({
        text: '"Marketing Plan"',
      } as any);

      const result = await generateChatTitle("What marketing strategies?");

      expect(result).toBe("Marketing Plan");
    });

    it("removes leading single quotes", async () => {
      mockGenerateText.mockResolvedValue({
        text: "'Marketing Plan",
      } as any);

      const result = await generateChatTitle("What marketing strategies?");

      expect(result).toBe("Marketing Plan");
    });

    it("removes trailing single quotes", async () => {
      mockGenerateText.mockResolvedValue({
        text: "Marketing Plan'",
      } as any);

      const result = await generateChatTitle("What marketing strategies?");

      expect(result).toBe("Marketing Plan");
    });

    it("removes both leading and trailing single quotes", async () => {
      mockGenerateText.mockResolvedValue({
        text: "'Marketing Plan'",
      } as any);

      const result = await generateChatTitle("What marketing strategies?");

      expect(result).toBe("Marketing Plan");
    });

    it("does not remove quotes in the middle of the title", async () => {
      mockGenerateText.mockResolvedValue({
        text: "User's Plan",
      } as any);

      const result = await generateChatTitle("Help me with the user's plan");

      expect(result).toBe("User's Plan");
    });
  });

  describe("prompt instructions", () => {
    it("instructs model to generate title under 20 characters", async () => {
      mockGenerateText.mockResolvedValue({
        text: "Short Title",
      } as any);

      await generateChatTitle("A very long question about many things");

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringMatching(/20 characters/i),
        }),
      );
    });

    it("instructs model to highlight segment names if present", async () => {
      mockGenerateText.mockResolvedValue({
        text: "Active Fans",
      } as any);

      await generateChatTitle("Show me the Active Fans segment");

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringMatching(/segment/i),
        }),
      );
    });

    it("instructs model not to wrap title in quotes", async () => {
      mockGenerateText.mockResolvedValue({
        text: "Clean Title",
      } as any);

      await generateChatTitle("Some question");

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringMatching(/Do not wrap.*quotes/i),
        }),
      );
    });
  });

  describe("edge cases", () => {
    it("handles empty input gracefully", async () => {
      mockGenerateText.mockResolvedValue({
        text: "New Chat",
      } as any);

      const result = await generateChatTitle("");

      expect(result).toBe("New Chat");
    });

    it("handles very long input", async () => {
      mockGenerateText.mockResolvedValue({
        text: "Long Discussion",
      } as any);

      const longInput = "a".repeat(1000);
      const result = await generateChatTitle(longInput);

      expect(result).toBe("Long Discussion");
    });
  });
});
