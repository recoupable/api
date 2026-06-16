import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSongstatsWithBackoff } from "../fetchSongstatsWithBackoff";
import { fetchSongstats } from "../fetchSongstats";

vi.mock("../fetchSongstats", () => ({ fetchSongstats: vi.fn() }));

const noSleep = vi.fn().mockResolvedValue(undefined);

describe("fetchSongstatsWithBackoff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns immediately on 200 with no retries or sleeps", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({ status: 200, data: { ok: true } });

    const r = await fetchSongstatsWithBackoff(
      "tracks/historic_stats",
      { isrc: "I" },
      { sleep: noSleep },
    );

    expect(fetchSongstats).toHaveBeenCalledTimes(1);
    expect(noSleep).not.toHaveBeenCalled();
    expect(r).toMatchObject({ status: 200, attempts: 1, retriesExhausted: false });
  });

  it("does NOT retry a non-retryable status (404)", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({ status: 404, data: {} });

    const r = await fetchSongstatsWithBackoff("p", undefined, { sleep: noSleep });

    expect(fetchSongstats).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ status: 404, retriesExhausted: false });
  });

  it("backs off and retries on 429, succeeding on a later attempt", async () => {
    vi.mocked(fetchSongstats)
      .mockResolvedValueOnce({ status: 429, data: {} })
      .mockResolvedValueOnce({ status: 429, data: {} })
      .mockResolvedValueOnce({ status: 200, data: { ok: true } });

    const r = await fetchSongstatsWithBackoff("p", undefined, { sleep: noSleep, baseMs: 100 });

    expect(fetchSongstats).toHaveBeenCalledTimes(3);
    expect(noSleep).toHaveBeenCalledTimes(2);
    // exponential: 100 then 200
    expect(noSleep).toHaveBeenNthCalledWith(1, 100);
    expect(noSleep).toHaveBeenNthCalledWith(2, 200);
    expect(r).toMatchObject({ status: 200, attempts: 3, retriesExhausted: false });
  });

  it("gives up after maxRetries on persistent 429 and flags retriesExhausted", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({ status: 429, data: {} });

    const r = await fetchSongstatsWithBackoff("p", undefined, { sleep: noSleep, maxRetries: 3 });

    expect(fetchSongstats).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    expect(noSleep).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ status: 429, retriesExhausted: true });
  });

  it("treats 5xx and 408 as retryable too", async () => {
    vi.mocked(fetchSongstats)
      .mockResolvedValueOnce({ status: 503, data: {} })
      .mockResolvedValueOnce({ status: 200, data: {} });
    const r = await fetchSongstatsWithBackoff("p", undefined, { sleep: noSleep, maxRetries: 2 });
    expect(fetchSongstats).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ status: 200, retriesExhausted: false });
  });

  it("caps the backoff at maxMs", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({ status: 429, data: {} });
    await fetchSongstatsWithBackoff("p", undefined, {
      sleep: noSleep,
      baseMs: 1000,
      maxMs: 1500,
      maxRetries: 3,
    });
    // 1000, 2000->capped 1500, 4000->capped 1500
    expect(noSleep.mock.calls.map(c => c[0])).toEqual([1000, 1500, 1500]);
  });
});
