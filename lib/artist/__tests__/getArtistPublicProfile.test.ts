import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  getAccountArtistIdsMock,
  selectSongArtistsMock,
  selectCatalogsBySongsMock,
  countCatalogSongsMock,
} = vi.hoisted(() => ({
  getAccountArtistIdsMock: vi.fn(),
  selectSongArtistsMock: vi.fn(),
  selectCatalogsBySongsMock: vi.fn(),
  countCatalogSongsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/account_artist_ids/getAccountArtistIds", () => ({
  getAccountArtistIds: getAccountArtistIdsMock,
}));
vi.mock("@/lib/supabase/song_artists/selectSongArtists", () => ({
  selectSongArtists: selectSongArtistsMock,
}));
vi.mock("@/lib/supabase/catalog_songs/selectCatalogsBySongs", () => ({
  selectCatalogsBySongs: selectCatalogsBySongsMock,
}));
vi.mock("@/lib/supabase/catalog_songs/countCatalogSongs", () => ({
  countCatalogSongs: countCatalogSongsMock,
}));

const { getArtistPublicProfile } = await import("@/lib/artist/getArtistPublicProfile");

const ARTIST = "5e9eca42-b5af-47ef-83c9-3e498506a3d6";

const rosterRow = {
  artist_info: {
    id: ARTIST,
    name: "Brauxelion",
    account_socials: [
      {
        social: {
          id: "soc_1",
          profile_url: "https://open.spotify.com/artist/abc",
          username: "brauxelion",
        },
      },
      {
        social: {
          id: "soc_2",
          profile_url: "https://instagram.com/brauxelion",
          username: "brauxelion",
        },
      },
    ],
    account_info: [
      {
        image: "https://cdn.example/brauxelion.jpg",
        instruction: "PRIVATE INSTRUCTIONS",
        knowledges: ["PRIVATE"],
        label: "PRIVATE LABEL",
      },
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  getAccountArtistIdsMock.mockResolvedValue([rosterRow]);
  selectSongArtistsMock.mockResolvedValue([
    { song: "ISRC1", artist: ARTIST },
    { song: "ISRC2", artist: ARTIST },
    { song: "ISRC1", artist: ARTIST },
  ]);
  selectCatalogsBySongsMock.mockResolvedValue([
    { id: "cat_1", name: "Brauxelion Catalog", updated_at: "2026-08-01" },
  ]);
  countCatalogSongsMock.mockResolvedValue({ cat_1: 24 });
});

describe("getArtistPublicProfile", () => {
  it("returns the public profile: name, image, socials, catalogs with song counts", async () => {
    const profile = await getArtistPublicProfile(ARTIST);

    expect(profile).toEqual({
      id: ARTIST,
      name: "Brauxelion",
      image: "https://cdn.example/brauxelion.jpg",
      socials: [
        {
          type: "SPOTIFY",
          username: "brauxelion",
          profile_url: "https://open.spotify.com/artist/abc",
        },
        {
          type: "INSTAGRAM",
          username: "brauxelion",
          profile_url: "https://instagram.com/brauxelion",
        },
      ],
      catalogs: [
        { id: "cat_1", name: "Brauxelion Catalog", song_count: 24, updated_at: "2026-08-01" },
      ],
    });
  });

  // The safety property: the response is an allowlist. Private account_info
  // fields must never appear, whatever the row carries.
  it("never leaks instruction, knowledges or label", async () => {
    const profile = await getArtistPublicProfile(ARTIST);

    const json = JSON.stringify(profile);
    expect(json).not.toContain("PRIVATE");
    expect(profile).not.toHaveProperty("instruction");
    expect(profile).not.toHaveProperty("knowledges");
    expect(profile).not.toHaveProperty("label");
  });

  // An account is an artist iff it appears as artist_id on someone's roster.
  // Personal and workspace accounts get null, which the handler 404s.
  it("returns null for an account that is not on any roster as an artist", async () => {
    getAccountArtistIdsMock.mockResolvedValue([]);

    expect(await getArtistPublicProfile(ARTIST)).toBeNull();
    expect(selectSongArtistsMock).not.toHaveBeenCalled();
  });

  // Catalogs come from the songs graph: catalog_songs joined through the
  // artist's credited ISRCs. account_catalogs links catalogs to their OWNER
  // account, which for an artist page is the wrong relationship.
  it("resolves catalogs through the artist's credited songs, not catalog ownership", async () => {
    await getArtistPublicProfile(ARTIST);

    expect(selectSongArtistsMock).toHaveBeenCalledWith({ artists: [ARTIST] });
    expect(selectCatalogsBySongsMock).toHaveBeenCalledWith(["ISRC1", "ISRC2"]);
  });

  // selectSongArtists throws on query error (chat#1965); the unauthenticated
  // artist page degrades to an empty catalog list instead of a 500.
  it("degrades to an empty catalog list when the songs-graph lookup fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    selectSongArtistsMock.mockRejectedValue(new Error("query failed"));
    selectCatalogsBySongsMock.mockResolvedValue([]);

    const profile = await getArtistPublicProfile(ARTIST);

    expect(profile?.id).toBe(ARTIST);
    expect(profile?.catalogs).toEqual([]);
    consoleSpy.mockRestore();
  });

  it("returns no catalogs for an artist with no credited songs", async () => {
    selectSongArtistsMock.mockResolvedValue([]);
    selectCatalogsBySongsMock.mockResolvedValue([]);

    const profile = await getArtistPublicProfile(ARTIST);
    expect(profile?.catalogs).toEqual([]);
  });

  it("returns image null and empty arrays when the artist has no info, socials or catalogs", async () => {
    getAccountArtistIdsMock.mockResolvedValue([
      { artist_info: { id: ARTIST, name: "Bare", account_socials: [], account_info: [] } },
    ]);
    selectSongArtistsMock.mockResolvedValue([]);
    selectCatalogsBySongsMock.mockResolvedValue([]);
    countCatalogSongsMock.mockResolvedValue({});

    expect(await getArtistPublicProfile(ARTIST)).toEqual({
      id: ARTIST,
      name: "Bare",
      image: null,
      socials: [],
      catalogs: [],
    });
  });

  it("defaults a missing song count to 0", async () => {
    countCatalogSongsMock.mockResolvedValue({});

    const profile = await getArtistPublicProfile(ARTIST);
    expect(profile?.catalogs[0].song_count).toBe(0);
  });
});
