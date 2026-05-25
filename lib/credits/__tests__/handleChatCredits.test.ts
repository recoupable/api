import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getCreditUsage } from "@/lib/credits/getCreditUsage";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { handleChatCredits } from "../handleChatCredits";

vi.mock("@/lib/credits/getCreditUsage", () => ({
  getCreditUsage: vi.fn(),
}));

vi.mock("@/lib/credits/recordCreditDeduction", () => ({
  recordCreditDeduction: vi.fn(),
}));

const mockGetCreditUsage = vi.mocked(getCreditUsage);
const mockRecordCreditDeduction = vi.mocked(recordCreditDeduction);

const USAGE = {
  inputTokens: 1000,
  outputTokens: 500,
  cachedInputTokens: 0,
} as never;

describe("handleChatCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("credit deduction", () => {
    it("deducts credits and forwards token detail to the usage_events row", async () => {
      mockGetCreditUsage.mockResolvedValue(0.05); // $0.05 = 5 credits
      mockRecordCreditDeduction.mockResolvedValue({ success: true, newBalance: 95 });

      await handleChatCredits({
        usage: USAGE,
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockGetCreditUsage).toHaveBeenCalledWith(USAGE, "gpt-4", undefined);
      expect(mockRecordCreditDeduction).toHaveBeenCalledWith({
        accountId: "account-123",
        creditsToDeduct: 5,
        source: "web",
        modelId: "gpt-4",
        inputTokens: 1000,
        outputTokens: 500,
        cachedInputTokens: 0,
      });
    });

    it("rounds credits to at least 1 when cost is very small", async () => {
      mockGetCreditUsage.mockResolvedValue(0.001);
      mockRecordCreditDeduction.mockResolvedValue({ success: true, newBalance: 99 });

      await handleChatCredits({
        usage: USAGE,
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockRecordCreditDeduction).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: "account-123", creditsToDeduct: 1 }),
      );
    });

    it("rounds credits correctly for larger amounts", async () => {
      mockGetCreditUsage.mockResolvedValue(1.234);
      mockRecordCreditDeduction.mockResolvedValue({ success: true, newBalance: 877 });

      await handleChatCredits({
        usage: USAGE,
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockRecordCreditDeduction).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: "account-123", creditsToDeduct: 123 }),
      );
    });
  });

  describe("skip conditions", () => {
    it("skips credit deduction when accountId is not provided", async () => {
      await handleChatCredits({
        usage: USAGE,
        model: "gpt-4",
        accountId: undefined,
      });

      expect(mockGetCreditUsage).not.toHaveBeenCalled();
      expect(mockRecordCreditDeduction).not.toHaveBeenCalled();
    });

    it("deducts minimum 1 credit when usage cost is 0", async () => {
      mockGetCreditUsage.mockResolvedValue(0);
      mockRecordCreditDeduction.mockResolvedValue({ success: true, newBalance: 332 });

      await handleChatCredits({
        usage: USAGE,
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockRecordCreditDeduction).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: "account-123", creditsToDeduct: 1 }),
      );
    });
  });

  describe("error handling", () => {
    it("does not throw when getCreditUsage fails", async () => {
      mockGetCreditUsage.mockRejectedValue(new Error("Pricing error"));

      await expect(
        handleChatCredits({
          usage: USAGE,
          model: "gpt-4",
          accountId: "account-123",
        }),
      ).resolves.not.toThrow();

      expect(mockRecordCreditDeduction).not.toHaveBeenCalled();
    });

    it("does not throw when recordCreditDeduction fails", async () => {
      mockGetCreditUsage.mockResolvedValue(0.05);
      mockRecordCreditDeduction.mockRejectedValue(new Error("Database error"));

      await expect(
        handleChatCredits({
          usage: USAGE,
          model: "gpt-4",
          accountId: "account-123",
        }),
      ).resolves.not.toThrow();
    });

    it("logs error when credit handling fails", async () => {
      const consoleSpy = vi.spyOn(console, "error");
      mockGetCreditUsage.mockRejectedValue(new Error("API error"));

      await handleChatCredits({
        usage: USAGE,
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(consoleSpy).toHaveBeenCalledWith("Failed to handle chat credits:", expect.any(Error));
    });
  });

  describe("gateway cost + source extensions", () => {
    it("forwards gatewayCostUsd to getCreditUsage when provided", async () => {
      mockGetCreditUsage.mockResolvedValue(0.07);
      mockRecordCreditDeduction.mockResolvedValue({ success: true, newBalance: 93 });

      await handleChatCredits({
        usage: USAGE,
        model: "anthropic/claude-haiku-4.5",
        accountId: "account-123",
        gatewayCostUsd: 0.07,
      });

      expect(mockGetCreditUsage).toHaveBeenCalledWith(USAGE, "anthropic/claude-haiku-4.5", 0.07);
    });

    it("defaults source to 'web' when not provided (backwards compatible)", async () => {
      mockGetCreditUsage.mockResolvedValue(0.05);
      mockRecordCreditDeduction.mockResolvedValue({ success: true, newBalance: 95 });

      await handleChatCredits({
        usage: USAGE,
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockRecordCreditDeduction).toHaveBeenCalledWith(
        expect.objectContaining({ source: "web" }),
      );
    });

    it("propagates source='api' when caller is the chat workflow", async () => {
      mockGetCreditUsage.mockResolvedValue(0.05);
      mockRecordCreditDeduction.mockResolvedValue({ success: true, newBalance: 95 });

      await handleChatCredits({
        usage: USAGE,
        model: "anthropic/claude-haiku-4.5",
        accountId: "account-123",
        source: "api",
      });

      expect(mockRecordCreditDeduction).toHaveBeenCalledWith(
        expect.objectContaining({ source: "api" }),
      );
    });
  });
});
