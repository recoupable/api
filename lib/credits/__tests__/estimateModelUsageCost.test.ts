import { describe, it, expect } from "vitest";
import { estimateModelUsageCost } from "@/lib/credits/estimateModelUsageCost";

const baseCost = { input: 1, output: 4 }; // $1/M in, $4/M out

describe("estimateModelUsageCost", () => {
  describe("guard rails", () => {
    it("returns undefined when cost catalog entry is missing", () => {
      expect(
        estimateModelUsageCost(
          { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 500 },
          undefined,
        ),
      ).toBeUndefined();
    });

    it("returns undefined when input price is missing", () => {
      expect(
        estimateModelUsageCost(
          { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 500 },
          { output: 4 },
        ),
      ).toBeUndefined();
    });

    it("returns undefined when output price is missing", () => {
      expect(
        estimateModelUsageCost(
          { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 500 },
          { input: 1 },
        ),
      ).toBeUndefined();
    });
  });

  describe("base tier (≤200k input tokens)", () => {
    it("computes uncached input + output cost in USD", () => {
      // 1_000_000 in @ $1/M + 1_000_000 out @ $4/M = $5
      expect(
        estimateModelUsageCost(
          {
            inputTokens: 1_000_000,
            cachedInputTokens: 0,
            outputTokens: 1_000_000,
          },
          baseCost,
        ),
      ).toBe(5);
    });

    it("applies cache_read price for cachedInputTokens portion when present", () => {
      // 100k cached @ $0.10/M + 100k uncached @ $1/M + 100k out @ $4/M
      // = 0.01 + 0.10 + 0.40 = $0.51
      const cost = { input: 1, output: 4, cache_read: 0.1 };
      expect(
        estimateModelUsageCost(
          { inputTokens: 200_000, cachedInputTokens: 100_000, outputTokens: 100_000 },
          cost,
        ),
      ).toBeCloseTo(0.51, 6);
    });

    it("falls back to input price when cache_read is undefined (cached tokens billed at full price)", () => {
      // 100k cached @ $1/M + 100k uncached @ $1/M + 100k out @ $4/M
      // = 0.10 + 0.10 + 0.40 = $0.60
      expect(
        estimateModelUsageCost(
          { inputTokens: 200_000, cachedInputTokens: 100_000, outputTokens: 100_000 },
          baseCost,
        ),
      ).toBeCloseTo(0.6, 6);
    });

    it("clamps negative cachedInputTokens to 0", () => {
      expect(
        estimateModelUsageCost(
          { inputTokens: 1_000_000, cachedInputTokens: -50_000, outputTokens: 0 },
          baseCost,
        ),
      ).toBe(1);
    });

    it("clamps cachedInputTokens > inputTokens so uncached doesn't go negative", () => {
      // cached=200_000 but input=100_000 — uncached must clamp to 0 (not -100_000).
      // 200_000 cached @ $1/M (no cache_read, falls back to input) + 0 out = $0.20.
      // Without the Math.max guard, this would underbill: a negative uncached count
      // times the input price would subtract from the cached charge.
      expect(
        estimateModelUsageCost(
          { inputTokens: 100_000, cachedInputTokens: 200_000, outputTokens: 0 },
          baseCost,
        ),
      ).toBeCloseTo(0.2, 6);
    });

    it("clamps negative outputTokens to 0", () => {
      expect(
        estimateModelUsageCost(
          { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: -1000 },
          baseCost,
        ),
      ).toBe(1);
    });
  });

  describe("context_over_200k tier", () => {
    const tieredCost = {
      input: 1,
      output: 4,
      context_over_200k: { input: 2, output: 8 },
    };

    it("uses context_over_200k tier when inputTokens exceeds 200k", () => {
      // 300_000 in @ $2/M + 100_000 out @ $8/M = 0.60 + 0.80 = $1.40
      expect(
        estimateModelUsageCost(
          { inputTokens: 300_000, cachedInputTokens: 0, outputTokens: 100_000 },
          tieredCost,
        ),
      ).toBeCloseTo(1.4, 6);
    });

    it("does NOT use context_over_200k tier when inputTokens is exactly 200k", () => {
      // boundary check — must be strictly > 200k
      // 200_000 @ $1/M + 0 out = $0.20
      expect(
        estimateModelUsageCost(
          { inputTokens: 200_000, cachedInputTokens: 0, outputTokens: 0 },
          tieredCost,
        ),
      ).toBeCloseTo(0.2, 6);
    });

    it("ignores context_over_200k when both input and output overrides are missing", () => {
      // only cache_read is set in the override — should NOT trigger the tier swap
      const cost = {
        input: 1,
        output: 4,
        context_over_200k: { cache_read: 0.5 },
      };
      // Treated as base tier — 300k @ $1/M + 0 out = $0.30
      expect(
        estimateModelUsageCost(
          { inputTokens: 300_000, cachedInputTokens: 0, outputTokens: 0 },
          cost,
        ),
      ).toBeCloseTo(0.3, 6);
    });

    it("falls back to base tier input when context_over_200k.input is missing", () => {
      const cost = {
        input: 1,
        output: 4,
        context_over_200k: { output: 8 }, // only output overridden
      };
      // 300k in @ $1/M (fallback) + 100k out @ $8/M = 0.30 + 0.80 = $1.10
      expect(
        estimateModelUsageCost(
          { inputTokens: 300_000, cachedInputTokens: 0, outputTokens: 100_000 },
          cost,
        ),
      ).toBeCloseTo(1.1, 6);
    });
  });
});
