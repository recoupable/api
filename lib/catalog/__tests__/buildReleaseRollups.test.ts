import { describe, it, expect } from "vitest";
import { buildReleaseRollups } from "../buildReleaseRollups";

describe("buildReleaseRollups", () => {
  it("groups songs by album, joins play counts by ISRC, and sorts by streams desc", () => {
    const songs = [
      { album: "Album A", isrc: "US1", artists: [{ name: "Nova" }] },
      { album: "Album A", isrc: "US2", artists: [{ name: "Nova" }, { name: "Guest" }] },
      { album: "Album B", isrc: "US3", artists: [{ name: "Nova" }] },
    ];
    const measurements = [
      { isrc: "US1", playcount: 100 },
      { isrc: "US2", playcount: 200 },
      { isrc: "US3", playcount: 5000 },
    ];

    const rollups = buildReleaseRollups(songs, measurements);

    expect(rollups).toEqual([
      {
        album: "Album B",
        artistNames: ["Nova"],
        trackCount: 1,
        measuredTrackCount: 1,
        streams: 5000,
      },
      {
        album: "Album A",
        artistNames: ["Nova", "Guest"],
        trackCount: 2,
        measuredTrackCount: 2,
        streams: 300,
      },
    ]);
  });

  it("proportional shares of the band sum back to the headline (no divergence)", () => {
    const songs = [
      { album: "A", isrc: "US1", artists: [] },
      { album: "B", isrc: "US2", artists: [] },
    ];
    const measurements = [
      { isrc: "US1", playcount: 300 },
      { isrc: "US2", playcount: 700 },
    ];
    const bandMid = 1_000_000;

    const rollups = buildReleaseRollups(songs, measurements);
    const total = rollups.reduce((s, r) => s + r.streams, 0);
    const perAlbum = rollups.map(r => (bandMid * r.streams) / total);

    expect(total).toBe(1000);
    expect(perAlbum.reduce((s, v) => s + v, 0)).toBeCloseTo(bandMid, 5);
  });

  it("is null-safe: null album/name/artist entries never throw", () => {
    const songs = [
      { album: null, isrc: "US1", artists: [null, { name: null }] },
      { album: "  ", isrc: "US2", artists: null },
    ] as never;

    const rollups = buildReleaseRollups(songs, []);

    expect(rollups).toHaveLength(1);
    expect(rollups[0].album).toBeNull();
    expect(rollups[0].trackCount).toBe(2);
    expect(rollups[0].measuredTrackCount).toBe(0);
    expect(rollups[0].artistNames).toEqual([]);
  });

  it("counts unmeasured tracks toward trackCount but not streams", () => {
    const songs = [
      { album: "A", isrc: "US1", artists: [] },
      { album: "A", isrc: "US2", artists: [] },
    ];
    const rollups = buildReleaseRollups(songs, [{ isrc: "US1", playcount: 42 }]);

    expect(rollups[0]).toMatchObject({ trackCount: 2, measuredTrackCount: 1, streams: 42 });
  });
});
