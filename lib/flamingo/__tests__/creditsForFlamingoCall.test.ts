import { describe, it, expect } from "vitest";
import { creditsForFlamingoCall, FLAMINGO_BASE_CREDITS } from "../creditsForFlamingoCall";

describe("creditsForFlamingoCall", () => {
  // The price is a one-cent base per model call plus twice what the call cost
  // us. The cost comes from Modal on every response (`cost_usd`: the
  // workspace's live GPU rate × the seconds it measured); the api holds no
  // rate of its own. A credit is a micro-dollar, so the base is 10,000.
  it("charges the base plus 2x the cost Modal reported", () => {
    // $0.01749 of compute → $0.03498 → 34,980 credits, plus the 10,000 base.
    expect(creditsForFlamingoCall({ costUsd: 0.01749 })).toBe(44_980);
    expect(FLAMINGO_BASE_CREDITS).toBe(10_000);
  });

  it("follows Modal's figure when Modal reprices", () => {
    // If the A100 moved to $3.00/h, a 30 s call costs $0.025 → 2x = 50,000 + base.
    expect(creditsForFlamingoCall({ costUsd: 0.025 })).toBe(60_000);
  });

  it("prices fractional costs exactly, since the unit is finer than the rate", () => {
    // 1.52 s at $2.10/h = $0.00088667 → 2x = $0.00177333 → 1,773 + base.
    expect(creditsForFlamingoCall({ costUsd: 0.00088667 })).toBe(11_773);
  });

  it("charges only the base when the response carries no usable cost", () => {
    // A deployment older than cost_usd, or a malformed number: the call ran,
    // so the base is owed; the missing compute is logged upstream, not guessed.
    expect(creditsForFlamingoCall({})).toBe(10_000);
    expect(creditsForFlamingoCall({ costUsd: 0 })).toBe(10_000);
    expect(creditsForFlamingoCall({ costUsd: -1 })).toBe(10_000);
    expect(creditsForFlamingoCall({ costUsd: Number.NaN })).toBe(10_000);
    expect(creditsForFlamingoCall({ costUsd: Number.POSITIVE_INFINITY })).toBe(10_000);
  });
});
