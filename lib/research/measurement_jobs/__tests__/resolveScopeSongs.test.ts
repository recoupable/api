import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveScopeSongs } from "../resolveScopeSongs";
import { selectSongIdentifiers } from "@/lib/supabase/song_identifiers/selectSongIdentifiers";
import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";

vi.mock("@/lib/supabase/song_identifiers/selectSongIdentifiers", () => ({
  selectSongIdentifiers: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists", () => ({
  selectCatalogSongsWithArtists: vi.fn(),
}));

describe("resolveScopeSongs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns deduped isrcs directly", async () => {
    expect(await resolveScopeSongs({ isrcs: ["A", "A", "B"] })).toEqual(["A", "B"]);
    expect(selectSongIdentifiers).not.toHaveBeenCalled();
  });

  it("resolves album_ids to their mapped song isrcs", async () => {
    vi.mocked(selectSongIdentifiers).mockResolvedValue([
      { song: "I1", platform: "spotify", identifier_type: "album_id", value: "AL1" },
      { song: "I2", platform: "spotify", identifier_type: "album_id", value: "AL1" },
    ]);
    const out = await resolveScopeSongs({ album_ids: ["AL1"] });
    expect(selectSongIdentifiers).toHaveBeenCalledWith({
      platform: "spotify",
      identifierType: "album_id",
      values: ["AL1"],
    });
    expect(out).toEqual(["I1", "I2"]);
  });

  it("resolves a catalog_id to its song isrcs", async () => {
    vi.mocked(selectCatalogSongsWithArtists).mockResolvedValue({
      songs: [{ isrc: "I1" }, { isrc: "I2" }],
    } as never);
    const out = await resolveScopeSongs({ catalog_id: "cat-1" });
    expect(out).toEqual(["I1", "I2"]);
  });
});
