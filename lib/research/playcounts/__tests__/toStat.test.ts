import { describe, it, expect } from "vitest";
import { toStat } from "../toStat";

describe("toStat", () => {
  it("shapes a measurement row into the stats[] entry envelope", () => {
    expect(
      toStat({
        value: 1332534384,
        captured_at: "2026-06-10T23:10:49Z",
        data_source: "apify_spotify_playcount",
      }),
    ).toEqual({
      source: "spotify",
      data: { streams_total: 1332534384 },
      data_source: "apify_spotify_playcount",
      captured_at: "2026-06-10T23:10:49Z",
    });
  });
});
