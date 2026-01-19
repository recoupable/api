import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/ai/getModel", () => ({
  getModel: vi.fn(),
}));

import { getModel } from "@/lib/ai/getModel";
import { getCreditUsage } from "../getCreditUsage";

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
        promptTokens: 1000,
        completionTokens: 500,
      };

      const cost = await getCreditUsage(usage, "gpt-4");

      // Expected: 1000 * 0.00003 + 500 * 0.00006 = 0.03 + 0.03 = 0.06
      expect(cost).toBeCloseTo(0.06);
    });

    it("returns 0 when model is not found", async () => {
      mockGetModel.mockResolvedValue(undefined);

      const usage = {
        promptTokens: 1000,
        completionTokens: 500,
      };

      const cost = await getCreditUsage(usage, "unknown-model");

      expect(cost).toBe(0);
    });

    it("returns 0 when promptTokens is undefined", async () => {
      mockGetModel.mockResolvedValue({
        id: "gpt-4",
        pricing: {
          input: "0.00003",
          output: "0.00006",
        },
      } as any);

      const usage = {
        promptTokens: undefined as unknown as number,
        completionTokens: 500,
      };

      const cost = await getCreditUsage(usage, "gpt-4");

      expect(cost).toBe(0);
    });

    it("returns 0 when completionTokens is undefined", async () => {
      mockGetModel.mockResolvedValue({
        id: "gpt-4",
        pricing: {
          input: "0.00003",
          output: "0.00006",
        },
      } as any);

      const usage = {
        promptTokens: 1000,
        completionTokens: undefined as unknown as number,
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
        promptTokens: 1000,
        completionTokens: 500,
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
        promptTokens: 0,
        completionTokens: 0,
      };

      const cost = await getCreditUsage(usage, "gpt-4");

      expect(cost).toBe(0);
    });

    it("handles getModel errors gracefully", async () => {
      mockGetModel.mockRejectedValue(new Error("API error"));

      const usage = {
        promptTokens: 1000,
        completionTokens: 500,
      };

      const cost = await getCreditUsage(usage, "gpt-4");

      expect(cost).toBe(0);
    });
  });
});
