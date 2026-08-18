import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAccountArtistIdsMock, selectAccountCatalogsMock, countCatalogSongsMock } = vi.hoisted(
  () => ({
    getAccountArtistIdsMock: vi.fn(),
    selectAccountCatalogsMock: vi.fn(),
    countCatalogSongsMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/account_artist_ids/getAccountArtistIds", () => ({
  getAccountArtistIds: getAccountArtistIdsMock,
}));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalogs", () => ({
  selectAccountCatalogs: selectAccountCatalogsMock,
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
  selectAccountCatalogsMock.mockResolvedValue([
    {
      id: "cat_1",
      name: "Brauxelion Catalog",
      created_at: "c",
      updated_at: "2026-08-01",
      owners: [ARTIST],
    },
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
    expect(selectAccountCatalogsMock).not.toHaveBeenCalled();
  });

  it("returns image null and empty arrays when the artist has no info, socials or catalogs", async () => {
    getAccountArtistIdsMock.mockResolvedValue([
      { artist_info: { id: ARTIST, name: "Bare", account_socials: [], account_info: [] } },
    ]);
    selectAccountCatalogsMock.mockResolvedValue([]);
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
