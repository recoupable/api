import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isFresh } from "../isFresh";

describe("isFresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));
    delete process.env.SPOTIFY_PLAYCOUNT_TTL_HOURS;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.SPOTIFY_PLAYCOUNT_TTL_HOURS;
  });

  it("treats captures within the default 24h TTL as fresh", () => {
    expect(isFresh("2026-06-10T06:00:00Z")).toBe(true);
    expect(isFresh("2026-06-09T11:00:00Z")).toBe(false);
  });

  it("honors SPOTIFY_PLAYCOUNT_TTL_HOURS", () => {
    process.env.SPOTIFY_PLAYCOUNT_TTL_HOURS = "1";
    expect(isFresh("2026-06-10T11:30:00Z")).toBe(true);
    expect(isFresh("2026-06-10T10:30:00Z")).toBe(false);
  });
});
