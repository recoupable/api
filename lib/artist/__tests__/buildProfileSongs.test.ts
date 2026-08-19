import { describe, it, expect } from "vitest";
import { buildProfileSongs } from "@/lib/artist/buildProfileSongs";
import { computeValuationBand } from "@/lib/catalog/computeValuationBand";

const songRow = (isrc: string, name: string, album: string | null = null) => ({
  isrc,
  name,
  album,
  artwork_url: null as string | null,
});

const base = {
  catalogSongRows: [
    { catalog: "cat_1", song: "ISRC1" },
    { catalog: "cat_1", song: "ISRC2" },
  ],
  songs: [
    songRow("ISRC1", "Monster Truck", "Monster Truck"),
    songRow("ISRC2", "Hi-Tech", "Xpeed Gear"),
  ],
  plays: { ISRC1: 128441, ISRC2: 96102 },
  artwork: { ISRC1: "https://a/1.jpg" },
  earliestReleaseDates: { cat_1: "2021-06-01" },
};

describe("buildProfileSongs", () => {
  it("groups songs per catalog, sorted by plays descending, with all six public fields", () => {
    const { songsByCatalog } = buildProfileSongs(base);

    expect(songsByCatalog.cat_1.map(s => s.isrc)).toEqual(["ISRC1", "ISRC2"]);
    expect(songsByCatalog.cat_1[0]).toEqual({
      isrc: "ISRC1",
      name: "Monster Truck",
      album: "Monster Truck",
      artwork_url: "https://a/1.jpg",
      plays: 128441,
      est_value_usd: computeValuationBand({
        totalStreams: 128441,
        earliestReleaseDate: "2021-06-01",
      }).valuation.mid,
    });
    expect(songsByCatalog.cat_1[1].artwork_url).toBeNull();
  });

  it("caps each catalog at the top 50 by plays", () => {
    const many = Array.from({ length: 60 }, (_, i) => `S${i}`);
    const { songsByCatalog } = buildProfileSongs({
      catalogSongRows: many.map(s => ({ catalog: "cat_1", song: s })),
      songs: many.map(s => songRow(s, `Song ${s}`)),
      plays: Object.fromEntries(many.map((s, i) => [s, 1000 - i])),
      artwork: {},
      earliestReleaseDates: {},
    });

    expect(songsByCatalog.cat_1).toHaveLength(50);
    expect(songsByCatalog.cat_1[0].plays).toBe(1000);
    expect(songsByCatalog.cat_1[49].plays).toBe(951);
  });

  it("computes the artist-level band across all songs, using the earliest release date", () => {
    const { valuation } = buildProfileSongs({
      ...base,
      catalogSongRows: [...base.catalogSongRows, { catalog: "cat_2", song: "ISRC3" }],
      songs: [...base.songs, songRow("ISRC3", "Third")],
      plays: { ...base.plays, ISRC3: 10000 },
      earliestReleaseDates: { cat_1: "2021-06-01", cat_2: "2019-01-01" },
    });

    expect(valuation).toEqual(
      computeValuationBand({
        totalStreams: 128441 + 96102 + 10000,
        earliestReleaseDate: "2019-01-01",
      }).valuation,
    );
  });

  it("returns a null valuation when no song has any measured plays", () => {
    const { valuation, songsByCatalog } = buildProfileSongs({
      ...base,
      plays: {},
    });

    expect(valuation).toBeNull();
    expect(songsByCatalog.cat_1.every(s => s.plays === 0 && s.est_value_usd === 0)).toBe(true);
  });
});
