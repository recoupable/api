import { describe, it, expect } from "vitest";
import { latestMeasurementsPerIsrc } from "../latestMeasurementsPerIsrc";
import type { Tables } from "@/types/database.types";

const row = (song: string, value: number, captured_at: string): Tables<"song_measurements"> =>
  ({
    id: `${song}-${captured_at}`,
    song,
    value,
    captured_at,
    created_at: captured_at,
    data_source: "spotify_web",
    metric: "platform_displayed_play_count",
    platform: "spotify",
    raw_ref: null,
    snapshot: null,
  }) as Tables<"song_measurements">;

describe("latestMeasurementsPerIsrc", () => {
  it("keeps only the newest capture per ISRC and sums the total", () => {
    // rows arrive newest-first (selectSongMeasurements orders captured_at desc)
    const rows = [
      row("ISRC1", 200, "2026-07-01T00:00:00Z"),
      row("ISRC2", 50, "2026-07-01T00:00:00Z"),
      row("ISRC1", 100, "2026-06-01T00:00:00Z"),
    ];
    const titles = new Map([
      ["ISRC1", "Song One"],
      ["ISRC2", null],
    ]);

    const result = latestMeasurementsPerIsrc(rows, titles);

    expect(result.totalStreams).toBe(250);
    expect(result.measurements).toEqual([
      { isrc: "ISRC1", title: "Song One", playcount: 200, measured_at: "2026-07-01T00:00:00Z" },
      { isrc: "ISRC2", title: null, playcount: 50, measured_at: "2026-07-01T00:00:00Z" },
    ]);
  });

  it("sorts measurements by playcount descending", () => {
    const rows = [
      row("ISRC1", 10, "2026-07-01T00:00:00Z"),
      row("ISRC2", 999, "2026-07-01T00:00:00Z"),
    ];

    const result = latestMeasurementsPerIsrc(rows, new Map());

    expect(result.measurements.map(m => m.isrc)).toEqual(["ISRC2", "ISRC1"]);
    expect(result.measurements[0].title).toBeNull();
  });

  it("returns an empty result for no rows", () => {
    expect(latestMeasurementsPerIsrc([], new Map())).toEqual({
      measurements: [],
      totalStreams: 0,
    });
  });
});
