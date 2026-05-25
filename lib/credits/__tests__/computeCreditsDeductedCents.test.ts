import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeCreditsDeductedCents } from "@/lib/credits/computeCreditsDeductedCents";
import { getAvailableModels } from "@/lib/ai/getAvailableModels";

vi.mock("@/lib/ai/getAvailableModels", () => ({
  getAvailableModels: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Default catalog: empty (forces token-estimate path to fall through to 1c).
  vi.mocked(getAvailableModels).mockResolvedValue([]);
});

const ZERO_USAGE = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };

describe("computeCreditsDeductedCents", () => {
  describe("gateway cost path (preferred)", () => {
    it("returns gateway cost in cents when gatewayCostUsd is a positive number", async () => {
      // $0.0074 → 0.74c → ceil to 1c minimum is not needed; round to 1c
      expect(
        await computeCreditsDeductedCents(ZERO_USAGE, "anthropic/claude-haiku-4.5", 0.0074),
      ).toBe(1);
      // $0.42 → 42c
      expect(
        await computeCreditsDeductedCents(ZERO_USAGE, "anthropic/claude-haiku-4.5", 0.42),
      ).toBe(42);
    });

    it("rounds the gateway cost to the nearest cent", async () => {
      // $0.123 → 12.3c → 12c
      expect(await computeCreditsDeductedCents(ZERO_USAGE, "model", 0.123)).toBe(12);
      // $0.126 → 12.6c → 13c
      expect(await computeCreditsDeductedCents(ZERO_USAGE, "model", 0.126)).toBe(13);
    });

    it("returns at least 1 when gateway cost rounds to 0", async () => {
      // $0.0001 → 0.01c → would round to 0, must bump to 1
      expect(await computeCreditsDeductedCents(ZERO_USAGE, "model", 0.0001)).toBe(1);
    });

    it("does NOT call the catalog when gateway cost is usable", async () => {
      await computeCreditsDeductedCents(ZERO_USAGE, "model", 0.05);
      expect(getAvailableModels).not.toHaveBeenCalled();
    });
  });

  describe("falls back to token-based estimate when gateway cost is unusable", () => {
    it("when gatewayCostUsd is undefined", async () => {
      vi.mocked(getAvailableModels).mockResolvedValue([
        { id: "model-x", cost: { input: 1, output: 4 } } as never,
      ]);
      // 1M in + 1M out → $5 → 500c
      expect(
        await computeCreditsDeductedCents(
          { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 },
          "model-x",
          undefined,
        ),
      ).toBe(500);
    });

    it("when gatewayCostUsd is 0", async () => {
      vi.mocked(getAvailableModels).mockResolvedValue([
        { id: "model-x", cost: { input: 1, output: 4 } } as never,
      ]);
      expect(
        await computeCreditsDeductedCents(
          { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 },
          "model-x",
          0,
        ),
      ).toBe(500);
    });

    it("when gatewayCostUsd is negative (corrupted/upstream bug)", async () => {
      vi.mocked(getAvailableModels).mockResolvedValue([
        { id: "model-x", cost: { input: 1, output: 4 } } as never,
      ]);
      expect(
        await computeCreditsDeductedCents(
          { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 },
          "model-x",
          -1,
        ),
      ).toBe(500);
    });

    it("when gatewayCostUsd is NaN (not Number.isFinite)", async () => {
      vi.mocked(getAvailableModels).mockResolvedValue([
        { id: "model-x", cost: { input: 1, output: 4 } } as never,
      ]);
      expect(
        await computeCreditsDeductedCents(
          { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 },
          "model-x",
          Number.NaN,
        ),
      ).toBe(500);
    });

    it("when gatewayCostUsd is Infinity", async () => {
      vi.mocked(getAvailableModels).mockResolvedValue([
        { id: "model-x", cost: { input: 1, output: 4 } } as never,
      ]);
      expect(
        await computeCreditsDeductedCents(
          { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 },
          "model-x",
          Number.POSITIVE_INFINITY,
        ),
      ).toBe(500);
    });
  });

  describe("estimate fallbacks (also: never charge zero on success)", () => {
    it("returns 1 when modelId is not in the catalog", async () => {
      vi.mocked(getAvailableModels).mockResolvedValue([
        { id: "other-model", cost: { input: 1, output: 4 } } as never,
      ]);
      expect(
        await computeCreditsDeductedCents(
          { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 1000 },
          "model-x",
          undefined,
        ),
      ).toBe(1);
    });

    it("returns 1 when the catalog has no cost for the model", async () => {
      vi.mocked(getAvailableModels).mockResolvedValue([{ id: "model-x" } as never]);
      expect(
        await computeCreditsDeductedCents(
          { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 1000 },
          "model-x",
          undefined,
        ),
      ).toBe(1);
    });

    it("returns 1 when getAvailableModels rejects", async () => {
      vi.mocked(getAvailableModels).mockRejectedValue(new Error("gateway down"));
      expect(
        await computeCreditsDeductedCents(
          { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 1000 },
          "model-x",
          undefined,
        ),
      ).toBe(1);
    });

    it("returns 1 when token estimate rounds to 0 (very tiny usage)", async () => {
      vi.mocked(getAvailableModels).mockResolvedValue([
        { id: "model-x", cost: { input: 0.0001, output: 0.0001 } } as never,
      ]);
      // ~$0.0000002 → 0.00002c → bumps to 1c minimum
      expect(
        await computeCreditsDeductedCents(
          { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
          "model-x",
          undefined,
        ),
      ).toBe(1);
    });
  });

  describe("model lookup", () => {
    it("matches modelId exactly (provider/model form)", async () => {
      vi.mocked(getAvailableModels).mockResolvedValue([
        { id: "anthropic/claude-haiku-4.5", cost: { input: 1, output: 4 } } as never,
        { id: "openai/gpt-5", cost: { input: 10, output: 40 } } as never,
      ]);
      // Pick haiku: 1M in + 1M out @ haiku rates → $5 → 500c
      expect(
        await computeCreditsDeductedCents(
          { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 },
          "anthropic/claude-haiku-4.5",
          undefined,
        ),
      ).toBe(500);
    });
  });
});
