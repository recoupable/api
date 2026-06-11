import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveSnapshotAlbums } from "../resolveSnapshotAlbums";

import { selectSongIdentifiers } from "@/lib/supabase/song_identifiers/selectSongIdentifiers";
import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";

vi.mock("@/lib/supabase/song_identifiers/selectSongIdentifiers", () => ({
  selectSongIdentifiers: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists", () => ({
  selectCatalogSongsWithArtists: vi.fn(),
}));

describe("resolveSnapshotAlbums", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes album_ids through deduped", async () => {
    const result = await resolveSnapshotAlbums({ album_ids: ["a1", "a1", "a2"] });

    expect(result).toEqual(["a1", "a2"]);
    expect(selectSongIdentifiers).not.toHaveBeenCalled();
  });

  it("resolves isrcs to album ids via identifiers", async () => {
    vi.mocked(selectSongIdentifiers).mockResolvedValue([
      { song: "I1", platform: "spotify", identifier_type: "album_id", value: "a1" },
      { song: "I2", platform: "spotify", identifier_type: "album_id", value: "a1" },
    ]);

    const result = await resolveSnapshotAlbums({ isrcs: ["I1", "I2"] });

    expect(selectSongIdentifiers).toHaveBeenCalledWith({
      platform: "spotify",
      identifierType: "album_id",
      songs: ["I1", "I2"],
    });
    expect(result).toEqual(["a1"]);
  });

  it("resolves a catalog to album ids via its songs", async () => {
    vi.mocked(selectCatalogSongsWithArtists).mockResolvedValue({
      songs: [{ isrc: "I1" }, { isrc: "I2" }],
      total_count: 2,
    } as never);
    vi.mocked(selectSongIdentifiers).mockResolvedValue([
      { song: "I1", platform: "spotify", identifier_type: "album_id", value: "a9" },
    ]);

    const result = await resolveSnapshotAlbums({ catalog_id: "cat_1" });

    expect(selectCatalogSongsWithArtists).toHaveBeenCalledWith({ catalogId: "cat_1" });
    expect(result).toEqual(["a9"]);
  });
});
