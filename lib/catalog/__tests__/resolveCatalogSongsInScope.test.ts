import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveCatalogSongsInScope } from "../resolveCatalogSongsInScope";
import { selectCatalogSongTitles } from "@/lib/supabase/catalog_songs/selectCatalogSongTitles";
import { selectSongArtistIsrcs } from "@/lib/supabase/song_artists/selectSongArtistIsrcs";

vi.mock("@/lib/supabase/catalog_songs/selectCatalogSongTitles", () => ({
  selectCatalogSongTitles: vi.fn(),
}));
vi.mock("@/lib/supabase/song_artists/selectSongArtistIsrcs", () => ({
  selectSongArtistIsrcs: vi.fn(),
}));

const catalogId = "7d3e5c35-1fac-4b88-aa90-e2e4a52dfe78";
const artistAccountId = "b1814076-8e19-4a77-9dea-2ec150e26aaa";

const catalogSongs = [
  { isrc: "ISRC1", title: "Song One" },
  { isrc: "ISRC2", title: "Song Two" },
  { isrc: "ISRC3", title: "Song Three" },
];

describe("resolveCatalogSongsInScope", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns every catalog song when no artist filter is given", async () => {
    vi.mocked(selectCatalogSongTitles).mockResolvedValue(catalogSongs);

    const result = await resolveCatalogSongsInScope({ catalogId });

    expect(result).toEqual(catalogSongs);
    expect(selectSongArtistIsrcs).not.toHaveBeenCalled();
  });

  it("restricts to the catalog ∩ song_artists intersection when filtered", async () => {
    vi.mocked(selectCatalogSongTitles).mockResolvedValue(catalogSongs);
    // ISRC4 is linked to the artist but not in this catalog — must not leak in
    vi.mocked(selectSongArtistIsrcs).mockResolvedValue(["ISRC1", "ISRC3", "ISRC4"]);

    const result = await resolveCatalogSongsInScope({ catalogId, artistAccountId });

    expect(selectSongArtistIsrcs).toHaveBeenCalledWith(artistAccountId);
    expect(result).toEqual([
      { isrc: "ISRC1", title: "Song One" },
      { isrc: "ISRC3", title: "Song Three" },
    ]);
  });

  it("returns [] when the artist has no songs in the catalog", async () => {
    vi.mocked(selectCatalogSongTitles).mockResolvedValue(catalogSongs);
    vi.mocked(selectSongArtistIsrcs).mockResolvedValue(["OTHER1"]);

    expect(await resolveCatalogSongsInScope({ catalogId, artistAccountId })).toEqual([]);
  });
});
