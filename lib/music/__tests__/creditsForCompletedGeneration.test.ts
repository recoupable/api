import { describe, it, expect } from "vitest";
import { creditsForCompletedGeneration } from "../creditsForCompletedGeneration";

describe("creditsForCompletedGeneration", () => {
  it("charges the actual output length, not the requested one", () => {
    // The model routinely stops short: our songs averaged 39.9s against a 60s
    // default. Charging the request would have earned ~1.5x while calling
    // itself pass-through.
    expect(creditsForCompletedGeneration({ requestedSeconds: 60, actualSeconds: 25.87 })).toBe(
      51_740,
    );
  });

  it("charges the request when the model runs the full length", () => {
    expect(creditsForCompletedGeneration({ requestedSeconds: 60, actualSeconds: 60 })).toBe(
      120_000,
    );
  });

  it("never charges above what the caller was quoted", () => {
    // Observed: a 60s request came back at 60.07s, so the model is not hard
    // capped. Billing the overrun would exceed the quoted price.
    expect(creditsForCompletedGeneration({ requestedSeconds: 60, actualSeconds: 60.07 })).toBe(
      120_000,
    );
  });

  it("falls back to the requested duration when fal reports no length", () => {
    // Charging nothing would give away a song fal has already billed us for.
    expect(creditsForCompletedGeneration({ requestedSeconds: 60, actualSeconds: null })).toBe(
      120_000,
    );
  });

  it("treats a nonsensical zero-length result as unknown rather than free", () => {
    expect(creditsForCompletedGeneration({ requestedSeconds: 60, actualSeconds: 0 })).toBe(120_000);
  });
});
