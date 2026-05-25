import { describe, it, expect, vi } from "vitest";
import { delay } from "@/lib/time/delay";

describe("delay", () => {
  it("resolves after the specified delay (within tolerance)", async () => {
    const start = Date.now();
    await delay(50);
    const elapsed = Date.now() - start;
    // setTimeout fires "no earlier than" the requested duration; allow generous
    // headroom for CI jitter rather than asserting an exact value.
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(500);
  });

  it("resolves on the next tick when given 0", async () => {
    let resolved = false;
    const promise = delay(0).then(() => {
      resolved = true;
    });
    // Synchronously, the timer hasn't fired yet.
    expect(resolved).toBe(false);
    await promise;
    expect(resolved).toBe(true);
  });

  it("uses fake timers correctly (callers can drive it deterministically)", async () => {
    vi.useFakeTimers();
    let resolved = false;
    const promise = delay(100).then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(99);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });
});
