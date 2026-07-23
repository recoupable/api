import { describe, it, expect } from "vitest";
import {
  buildAlbumArtMap,
  buildValuationReleaseRows,
} from "../buildValuationReleaseRows";

describe("buildAlbumArtMap", () => {
  it("maps lowercased album names to the smallest cover-art url", () => {
    const albums = [
      {
        id: "1",
        name: "Album A",
        images: [
          { url: "big.jpg", height: 640, width: 640 },
          { url: "small.jpg", height: 64, width: 64 },
        ],
      },
      { id: "2", name: "No Art" },
    ];
    const map = buildAlbumArtMap(albums);
    expect(map.get("album a")).toBe("small.jpg");
    expect(map.has("no art")).toBe(false);
  });
});

describe("buildValuationReleaseRows", () => {
  const rollups = [
    { album: "Album B", artistNames: ["Nova"], trackCount: 1, measuredTrackCount: 1, streams: 700 },
    { album: "Album A", artistNames: ["Nova"], trackCount: 1, measuredTrackCount: 1, streams: 300 },
  ];

  it("computes proportional value that sums to the headline band", () => {
    const rows = buildValuationReleaseRows({
      rollups,
      totalStreams: 1000,
      bandMid: 1_000_000,
      artByAlbum: new Map([["album b", "b.jpg"]]),
    });
    expect(rows.map(r => r.value)).toEqual([700_000, 300_000]);
    expect(rows.reduce((s, r) => s + r.value, 0)).toBe(1_000_000);
    expect(rows[0].artUrl).toBe("b.jpg");
    expect(rows[1].artUrl).toBeNull();
  });

  it("is safe when totalStreams is zero (no divide-by-zero)", () => {
    const rows = buildValuationReleaseRows({
      rollups,
      totalStreams: 0,
      bandMid: 1_000_000,
      artByAlbum: new Map(),
    });
    expect(rows.every(r => r.value === 0)).toBe(true);
  });

  it("leaves art null for untitled releases", () => {
    const rows = buildValuationReleaseRows({
      rollups: [{ album: null, artistNames: [], trackCount: 1, measuredTrackCount: 0, streams: 0 }],
      totalStreams: 1000,
      bandMid: 1000,
      artByAlbum: new Map([["", "x.jpg"]]),
    });
    expect(rows[0].artUrl).toBeNull();
  });
});
