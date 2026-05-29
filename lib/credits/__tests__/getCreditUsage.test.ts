import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getModel } from "@/lib/ai/getModel";
import { getCreditUsage } from "../getCreditUsage";

vi.mock("@/lib/ai/getModel", () => ({
  getModel: vi.fn(),
}));

const mockGetModel = vi.mocked(getModel);

describe("getCreditUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("cost calculation", () => {
    it("calculates total cost from input and output tokens", async () => {
      mockGetModel.mockResolvedValue({
        id: "gpt-4",
        pricing: {
          input: "0.00003", // $0.03 per 1K tokens
          output: "0.00006", // $0.06 per 1K tokens
        },
      } as any);

      const usage = {
        inputTokens: 1000,
        outputTokens: 500,
      };

      const cost = await getCreditUsage(usage, "gpt-4");

      // Expected: 1000 * 0.00003 + 500 * 0.00006 = 0.03 + 0.03 = 0.06
      expect(cost).toBeCloseTo(0.06);
    });

    it("returns 0 when model is not found", async () => {
      mockGetModel.mockResolvedValue(undefined);

      const usage = {
        inputTokens: 1000,
        outputTokens: 500,
      };

      const cost = await getCreditUsage(usage, "unknown-model");

      expect(cost).toBe(0);
    });

    it("returns 0 when inputTokens is undefined", async () => {
      mockGetModel.mockResolvedValue({
        id: "gpt-4",
        pricing: {
          input: "0.00003",
          output: "0.00006",
        },
      } as any);

      const usage = {
        inputTokens: undefined as unknown as number,
        outputTokens: 500,
      };

      const cost = await getCreditUsage(usage, "gpt-4");

      expect(cost).toBe(0);
    });

    it("returns 0 when outputTokens is undefined", async () => {
      mockGetModel.mockResolvedValue({
        id: "gpt-4",
        pricing: {
          input: "0.00003",
          output: "0.00006",
        },
      } as any);

      const usage = {
        inputTokens: 1000,
        outputTokens: undefined as unknown as number,
      };

      const cost = await getCreditUsage(usage, "gpt-4");

      expect(cost).toBe(0);
    });

    it("handles model without pricing gracefully", async () => {
      mockGetModel.mockResolvedValue({
        id: "gpt-4",
        // No pricing property
      } as any);

      const usage = {
        inputTokens: 1000,
        outputTokens: 500,
      };

      const cost = await getCreditUsage(usage, "gpt-4");

      // Should return NaN or 0 - implementation should handle this
      expect(cost).toBe(0);
    });

    it("handles zero tokens", async () => {
      mockGetModel.mockResolvedValue({
        id: "gpt-4",
        pricing: {
          input: "0.00003",
          output: "0.00006",
        },
      } as any);

      const usage = {
        inputTokens: 0,
        outputTokens: 0,
      };

      const cost = await getCreditUsage(usage, "gpt-4");

      expect(cost).toBe(0);
    });

    it("handles getModel errors gracefully", async () => {
      mockGetModel.mockRejectedValue(new Error("API error"));

      const usage = {
        inputTokens: 1000,
        outputTokens: 500,
      };

      const cost = await getCreditUsage(usage, "gpt-4");

      expect(cost).toBe(0);
    });
  });

  describe("gateway cost short-circuit", () => {
    it("returns gatewayCostUsd directly when it is a positive number (skips catalog lookup)", async () => {
      const cost = await getCreditUsage(
        { inputTokens: 1000, outputTokens: 500 },
        "anthropic/claude-haiku-4.5",
        0.07,
      );
      expect(cost).toBe(0.07);
      expect(mockGetModel).not.toHaveBeenCalled();
    });

    it("falls through to token math when gatewayCostUsd is undefined", async () => {
      mockGetModel.mockResolvedValue({
        id: "gpt-4",
        pricing: { input: "0.00003", output: "0.00006" },
      } as any);

      const cost = await getCreditUsage(
        { inputTokens: 1000, outputTokens: 500 },
        "gpt-4",
        undefined,
      );
      // 1000 * 0.00003 + 500 * 0.00006 = 0.06
      expect(cost).toBeCloseTo(0.06);
      expect(mockGetModel).toHaveBeenCalledWith("gpt-4");
    });

    it("falls through to token math when gatewayCostUsd is 0", async () => {
      mockGetModel.mockResolvedValue({
        id: "gpt-4",
        pricing: { input: "0.00003", output: "0.00006" },
      } as any);

      const cost = await getCreditUsage({ inputTokens: 1000, outputTokens: 500 }, "gpt-4", 0);
      expect(cost).toBeCloseTo(0.06);
    });

    it("falls through to token math when gatewayCostUsd is negative", async () => {
      mockGetModel.mockResolvedValue({
        id: "gpt-4",
        pricing: { input: "0.00003", output: "0.00006" },
      } as any);

      const cost = await getCreditUsage({ inputTokens: 1000, outputTokens: 500 }, "gpt-4", -1);
      expect(cost).toBeCloseTo(0.06);
    });

    it("falls through to token math when gatewayCostUsd is NaN", async () => {
      mockGetModel.mockResolvedValue({
        id: "gpt-4",
        pricing: { input: "0.00003", output: "0.00006" },
      } as any);

      const cost = await getCreditUsage(
        { inputTokens: 1000, outputTokens: 500 },
        "gpt-4",
        Number.NaN,
      );
      expect(cost).toBeCloseTo(0.06);
    });

    it("falls through to token math when gatewayCostUsd is Infinity", async () => {
      mockGetModel.mockResolvedValue({
        id: "gpt-4",
        pricing: { input: "0.00003", output: "0.00006" },
      } as any);

      const cost = await getCreditUsage(
        { inputTokens: 1000, outputTokens: 500 },
        "gpt-4",
        Number.POSITIVE_INFINITY,
      );
      expect(cost).toBeCloseTo(0.06);
    });
  });
});
