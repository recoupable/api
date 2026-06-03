import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSongstats } from "../fetchSongstats";

const ORIGINAL_ENV = process.env;

describe("fetchSongstats", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, SongStats_API: "songstats-key" };
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
  });

  it("sends requests to the Enterprise API with the SongStats apikey header", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: "artist_1" }] }),
      headers: new Headers({ "content-type": "application/json" }),
    } as Response);

    const result = await fetchSongstats("/artists/search", { q: "Drake", limit: "1" });

    expect(result).toEqual({ status: 200, data: { results: [{ id: "artist_1" }] } });
    expect(fetch).toHaveBeenCalledWith(
      "https://data.songstats.com/enterprise/v1/artists/search?q=Drake&limit=1",
      {
        method: "GET",
        headers: {
          accept: "application/json",
          apikey: "songstats-key",
        },
      },
    );
  });

  it("returns a 500-compatible result when SongStats_API is not configured", async () => {
    delete process.env.SongStats_API;

    const result = await fetchSongstats("/artists/search", { q: "Drake" });

    expect(result.status).toBe(500);
    expect(result.data).toEqual({ error: "SongStats_API environment variable is not set" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("passes upstream error statuses through without throwing", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "forbidden" }),
      headers: new Headers({ "content-type": "application/json" }),
    } as Response);

    const result = await fetchSongstats("/artists/info", { songstats_artist_id: "artist_1" });

    expect(result).toEqual({ status: 403, data: { error: "forbidden" } });
  });
});
