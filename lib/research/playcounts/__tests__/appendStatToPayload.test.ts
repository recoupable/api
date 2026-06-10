import { describe, it, expect } from "vitest";
import { appendStatToPayload } from "../appendStatToPayload";

const STAT = {
  source: "spotify" as const,
  data: { streams_total: 1332534384 },
  data_source: "apify_spotify_playcount",
  captured_at: "2026-06-10T23:10:49Z",
};

describe("appendStatToPayload", () => {
  it("appends the stat to an existing stats array, preserving the envelope", () => {
    const payload = {
      result: "success",
      track_info: { name: "The Spins" },
      stats: [{ source: "deezer", data: {}, data_source: "songstats" }],
    };

    const result = appendStatToPayload(payload, STAT);

    expect(result).toEqual({
      result: "success",
      track_info: { name: "The Spins" },
      stats: [{ source: "deezer", data: {}, data_source: "songstats" }, STAT],
    });
  });

  it("creates the stats array when the payload has none", () => {
    expect(appendStatToPayload({ result: "success" }, STAT)).toEqual({
      result: "success",
      stats: [STAT],
    });
  });
});
