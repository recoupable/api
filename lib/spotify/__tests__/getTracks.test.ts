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

  it("returns an error on a failed response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 } as never);

    const { tracks, error } = await getTracks({ ids: ["t1"], accessToken: "tok" });

    expect(tracks).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });

  it("returns [] for empty input without fetching", async () => {
    const { tracks } = await getTracks({ ids: [], accessToken: "tok" });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(tracks).toEqual([]);
  });
});
