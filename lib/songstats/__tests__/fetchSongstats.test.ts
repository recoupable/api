import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSongstats } from "../fetchSongstats";

const ORIGINAL_ENV = process.env;

describe("fetchSongstats", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, SONGSTATS_API_KEY: "songstats-key" };
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = ORIGINAL_ENV;
    vi.restoreAllMocks();
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
      "https://api.songstats.com/enterprise/v1/artists/search?q=Drake&limit=1",
      expect.objectContaining({
        method: "GET",
        signal: expect.any(AbortSignal),
        headers: {
          accept: "application/json",
          apikey: "songstats-key",
        },
      }),
    );
  });

  it("uses the legacy SongStats_API env var when SONGSTATS_API_KEY is not configured", async () => {
    delete process.env.SONGSTATS_API_KEY;
    process.env.SongStats_API = "legacy-songstats-key";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
      headers: new Headers({ "content-type": "application/json" }),
    } as Response);

    await fetchSongstats("/artists/search", { q: "Drake" });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.songstats.com/enterprise/v1/artists/search?q=Drake",
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "legacy-songstats-key",
        }),
      }),
    );
  });

  it("returns a sanitized 500-compatible result when no SongStats API key is configured", async () => {
    delete process.env.SONGSTATS_API_KEY;
    delete process.env.SongStats_API;

    const result = await fetchSongstats("/artists/search", { q: "Drake" });

    expect(result.status).toBe(500);
    expect(result.data).toEqual({ error: "Internal server error" });
    expect(console.error).toHaveBeenCalledWith(
      "[ERROR] fetchSongstats: SONGSTATS_API_KEY or SongStats_API environment variable is not set",
    );
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

  it("aborts SongStats requests after the configured timeout", async () => {
    vi.useFakeTimers();
    process.env.SONGSTATS_TIMEOUT_MS = "25";
    vi.mocked(fetch).mockImplementation((_input, init) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      return new Promise<Response>((_, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });

    const resultPromise = fetchSongstats("/artists/search", { q: "Drake" });
    await vi.advanceTimersByTimeAsync(25);

    await expect(resultPromise).resolves.toEqual({
      status: 504,
      data: { error: "SongStats request timed out" },
    });
  });

  it("allows slower SongStats stats requests before aborting", async () => {
    vi.useFakeTimers();
    let abortCount = 0;
    vi.mocked(fetch).mockImplementation((_input, init) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      return new Promise<Response>((_, reject) => {
        signal.addEventListener("abort", () => {
          abortCount += 1;
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });

    const resultPromise = fetchSongstats("/artists/stats", {
      songstats_artist_id: "artist_1",
      source: "spotify",
    });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(abortCount).toBe(0);

    await vi.advanceTimersByTimeAsync(40_000);

    expect(abortCount).toBe(1);
    await expect(resultPromise).resolves.toEqual({
      status: 504,
      data: { error: "SongStats request timed out" },
    });
  });

  it("returns a sanitized 500-compatible result when fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    const result = await fetchSongstats("/artists/search", { q: "Drake" });

    expect(result).toEqual({
      status: 500,
      data: { error: "SongStats request failed" },
    });
  });
});
