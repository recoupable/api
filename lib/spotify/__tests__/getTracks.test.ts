import { describe, it, expect, vi, beforeEach } from "vitest";
import getTracks from "../getTracks";

const mockFetch = vi.fn();
global.fetch = mockFetch as never;

describe("getTracks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("batch-fetches tracks (50 per call) and concatenates results", async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `t${i}`);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tracks: [{ id: "t0", external_ids: { isrc: "ISRC0" } }] }),
    } as never);

    const { tracks, error } = await getTracks({ ids, accessToken: "tok" });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain(
      "ids=" + encodeURIComponent(ids.slice(0, 50).join(",")),
    );
    expect(error).toBeNull();
    expect(tracks).toHaveLength(2);
  });

  it("retries a 429 after Retry-After and succeeds (rate-limit backoff)", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (h: string) => (h === "Retry-After" ? "0" : null) },
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tracks: [{ id: "t1", external_ids: { isrc: "I1" } }] }),
      } as never);

    const { tracks, error } = await getTracks({ ids: ["t1"], accessToken: "tok" });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(error).toBeNull();
    expect(tracks).toHaveLength(1);
  });

  it("gives up after exhausting 429 retries", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (h: string) => (h === "Retry-After" ? "0" : null) },
    } as never);

    const { tracks, error } = await getTracks({ ids: ["t1"], accessToken: "tok" });

    expect(mockFetch).toHaveBeenCalledTimes(4); // 1 + 3 retries
    expect(tracks).toBeNull();
    expect(error?.message).toContain("429");
  });

  it("returns an error on a non-429 failed response without retrying", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as never);

    const { tracks, error } = await getTracks({ ids: ["t1"], accessToken: "tok" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(tracks).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });

  it("returns [] for empty input without fetching", async () => {
    const { tracks } = await getTracks({ ids: [], accessToken: "tok" });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(tracks).toEqual([]);
  });
});
