import { describe, it, expect } from "vitest";
import {
  DEFAULT_CREDITS,
  DEFAULT_CREDITS_USD,
  PRO_CREDITS,
  PRO_CREDITS_USD,
  STARTER_CREDITS,
} from "../const";
import { usdToCredits } from "../usdToCredits";

describe("credit grant totals", () => {
  it("derive from their dollar values through the shared conversion", () => {
    expect(DEFAULT_CREDITS).toBe(usdToCredits(DEFAULT_CREDITS_USD));
    expect(PRO_CREDITS).toBe(usdToCredits(PRO_CREDITS_USD));
  });

  it("are $3.33, $20 and $300 in micro-dollars", () => {
    expect(DEFAULT_CREDITS).toBe(3_330_000);
    expect(STARTER_CREDITS).toBe(20_000_000);
    expect(PRO_CREDITS).toBe(300_000_000);
  });
});
