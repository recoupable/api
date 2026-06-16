import { describe, it, expect } from "vitest";
import { isRetryableStatus } from "../isRetryableStatus";

describe("isRetryableStatus", () => {
  it("retries transient throttling/timeouts: 408, 429", () => {
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
  });

  it("retries transient gateway 5xx: 502, 503, 504", () => {
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
  });

  it("does NOT retry 500/501 (fetchSongstats maps missing key + fetch failures to 500)", () => {
    expect(isRetryableStatus(500)).toBe(false);
    expect(isRetryableStatus(501)).toBe(false);
  });

  it("does NOT retry definitive responses: 200, 404, 403", () => {
    expect(isRetryableStatus(200)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
  });
});
