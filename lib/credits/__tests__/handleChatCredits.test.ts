import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getCreditUsage } from "@/lib/credits/getCreditUsage";
import { deductCredits } from "@/lib/credits/deductCredits";
import { handleChatCredits } from "../handleChatCredits";

vi.mock("@/lib/credits/getCreditUsage", () => ({
  getCreditUsage: vi.fn(),
}));

vi.mock("@/lib/credits/deductCredits", () => ({
  deductCredits: vi.fn(),
}));

const mockGetCreditUsage = vi.mocked(getCreditUsage);
const mockDeductCredits = vi.mocked(deductCredits);

describe("handleChatCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("credit deduction", () => {
    it("deducts credits when accountId is provided and usage cost > 0", async () => {
      mockGetCreditUsage.mockResolvedValue(0.05); // $0.05 = 5 credits
      mockDeductCredits.mockResolvedValue({ success: true, newBalance: 95 });

      await handleChatCredits({
        usage: { promptTokens: 1000, completionTokens: 500 },
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockGetCreditUsage).toHaveBeenCalledWith(
        { promptTokens: 1000, completionTokens: 500 },
        "gpt-4",
      );
      expect(mockDeductCredits).toHaveBeenCalledWith({
        accountId: "account-123",
        creditsToDeduct: 5, // 0.05 * 100 = 5
      });
    });

    it("rounds credits to at least 1 when cost is very small", async () => {
      mockGetCreditUsage.mockResolvedValue(0.001); // $0.001 = 0.1 credits, rounds to 1
      mockDeductCredits.mockResolvedValue({ success: true, newBalance: 99 });

      await handleChatCredits({
        usage: { promptTokens: 10, completionTokens: 5 },
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockDeductCredits).toHaveBeenCalledWith({
        accountId: "account-123",
        creditsToDeduct: 1, // Math.max(1, Math.round(0.001 * 100)) = 1
      });
    });

    it("rounds credits correctly for larger amounts", async () => {
      mockGetCreditUsage.mockResolvedValue(1.234); // $1.234 = 123.4 credits, rounds to 123
      mockDeductCredits.mockResolvedValue({ success: true, newBalance: 877 });

      await handleChatCredits({
        usage: { promptTokens: 10000, completionTokens: 5000 },
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockDeductCredits).toHaveBeenCalledWith({
        accountId: "account-123",
        creditsToDeduct: 123,
      });
    });
  });

  describe("skip conditions", () => {
    it("skips credit deduction when accountId is not provided", async () => {
      await handleChatCredits({
        usage: { promptTokens: 1000, completionTokens: 500 },
        model: "gpt-4",
        accountId: undefined,
      });

      expect(mockGetCreditUsage).not.toHaveBeenCalled();
      expect(mockDeductCredits).not.toHaveBeenCalled();
    });

    it("skips credit deduction when usage cost is 0", async () => {
      mockGetCreditUsage.mockResolvedValue(0);

      await handleChatCredits({
        usage: { promptTokens: 0, completionTokens: 0 },
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockGetCreditUsage).toHaveBeenCalled();
      expect(mockDeductCredits).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("does not throw when getCreditUsage fails", async () => {
      mockGetCreditUsage.mockRejectedValue(new Error("Pricing error"));

      await expect(
        handleChatCredits({
          usage: { promptTokens: 1000, completionTokens: 500 },
          model: "gpt-4",
          accountId: "account-123",
        }),
      ).resolves.not.toThrow();

      expect(mockDeductCredits).not.toHaveBeenCalled();
    });

    it("does not throw when deductCredits fails", async () => {
      mockGetCreditUsage.mockResolvedValue(0.05);
      mockDeductCredits.mockRejectedValue(new Error("Database error"));

      await expect(
        handleChatCredits({
          usage: { promptTokens: 1000, completionTokens: 500 },
          model: "gpt-4",
          accountId: "account-123",
        }),
      ).resolves.not.toThrow();
    });

    it("logs error when credit handling fails", async () => {
      const consoleSpy = vi.spyOn(console, "error");
      mockGetCreditUsage.mockRejectedValue(new Error("API error"));

      await handleChatCredits({
        usage: { promptTokens: 1000, completionTokens: 500 },
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(consoleSpy).toHaveBeenCalledWith("Failed to handle chat credits:", expect.any(Error));
    });
  });
});
