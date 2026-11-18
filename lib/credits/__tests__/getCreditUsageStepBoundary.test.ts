import { beforeEach, expect, it, vi } from "vitest";
import { getCreditUsage } from "../getCreditUsage";
import { getTokenCreditUsageStep } from "../getTokenCreditUsageStep";

vi.mock("../getTokenCreditUsageStep", () => ({ getTokenCreditUsageStep: vi.fn(async () => 0.06) }));
// A red test against the old direct lookup must still never access a provider.
vi.mock("@/lib/ai/getModel", () => ({ getModel: vi.fn(async () => undefined) }));
const usage = {
  inputTokens: 1000,
  outputTokens: 500,
  totalTokens: 1500,
  inputTokenDetails: { noCacheTokens: 1000, cacheReadTokens: 0, cacheWriteTokens: 0 },
  outputTokenDetails: { textTokens: 500, reasoningTokens: 0 },
};
beforeEach(() => vi.clearAllMocks());

it("keeps a finite positive gateway cost outside the pricing lookup step", async () => {
  expect(await getCreditUsage(usage, "fixture", 0.07)).toBe(0.07);
  expect(getTokenCreditUsageStep).not.toHaveBeenCalled();
});

it.each([undefined, 0, -1, NaN, Infinity])(
  "routes fallback %s through one serializable pricing step",
  async cost => {
    expect(await getCreditUsage(usage, "fixture", cost)).toBe(0.06);
    expect(getTokenCreditUsageStep).toHaveBeenCalledExactlyOnceWith(
      { inputTokens: 1000, outputTokens: 500 },
      "fixture",
    );
  },
);
