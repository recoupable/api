import { describe, it, expect, vi, beforeEach } from "vitest";

import { attachSpotifySocialsToArtists } from "../attachSpotifySocialsToArtists";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";

vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));
vi.mock("@/lib/artist/updateArtistSocials", () => ({ updateArtistSocials: vi.fn() }));

const withSocial = (profileUrl: string) =>
  [{ id: "as-1", account_id: "a", social_id: "s", social: { profile_url: profileUrl } }] as never;

describe("attachSpotifySocialsToArtists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("attaches the Spotify artist profile (case preserved) when the artist has no Spotify social", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue([]);

    await attachSpotifySocialsToArtists([
      // Case-sensitive base62 id — the legacy lowercasing corruption must not repeat here.
      { artistAccountId: "artist-1", spotifyArtistId: "0xPoVNPnxIIUS1vrxAYV00" },
    ]);

    expect(updateArtistSocials).toHaveBeenCalledWith("artist-1", {
      SPOTIFY: "https://open.spotify.com/artist/0xPoVNPnxIIUS1vrxAYV00",
    });
  });

  it("skips artists that already have a Spotify artist social (never clobbers)", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue(
      withSocial("open.spotify.com/artist/already123"),
    );

    await attachSpotifySocialsToArtists([
      { artistAccountId: "artist-1", spotifyArtistId: "newId456" },
    ]);

    expect(updateArtistSocials).not.toHaveBeenCalled();
  });

  it("attaches when the artist has socials on other platforms only", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue(withSocial("instagram.com/somebody"));

    await attachSpotifySocialsToArtists([{ artistAccountId: "artist-1", spotifyArtistId: "abc" }]);

    expect(updateArtistSocials).toHaveBeenCalledWith("artist-1", {
      SPOTIFY: "https://open.spotify.com/artist/abc",
    });
  });

  it("dedupes by artist account (one write per artist per batch)", async () => {
    vi.mocked(selectAccountSocials).mockResolvedValue([]);

    await attachSpotifySocialsToArtists([
      { artistAccountId: "artist-1", spotifyArtistId: "abc" },
      { artistAccountId: "artist-1", spotifyArtistId: "abc" },
    ]);

    expect(updateArtistSocials).toHaveBeenCalledTimes(1);
  });

  it("never throws and continues past per-artist failures", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(selectAccountSocials)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce([]);

    await expect(
      attachSpotifySocialsToArtists([
        { artistAccountId: "artist-1", spotifyArtistId: "abc" },
        { artistAccountId: "artist-2", spotifyArtistId: "def" },
      ]),
    ).resolves.toBeUndefined();

    expect(updateArtistSocials).toHaveBeenCalledWith("artist-2", {
      SPOTIFY: "https://open.spotify.com/artist/def",
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
