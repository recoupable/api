import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichArtistSpotifyProfile } from "../enrichArtistSpotifyProfile";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getArtist from "@/lib/spotify/getArtist";
import { enrichSearchedArtistProfile } from "@/lib/valuation/enrichSearchedArtistProfile";

vi.mock("@/lib/spotify/generateAccessToken", () => ({ default: vi.fn() }));
vi.mock("@/lib/spotify/getArtist", () => ({ default: vi.fn() }));
vi.mock("@/lib/valuation/enrichSearchedArtistProfile", () => ({
  enrichSearchedArtistProfile: vi.fn(),
}));

const artistId = "b1814076-8e19-4a77-9dea-2ec150e26aaa";
const spotifyArtistId = "4Z8W4fKeB5YxbusRsdQVPb";

const okToken = () =>
  vi.mocked(generateAccessToken).mockResolvedValue({
    access_token: "tok",
    token_type: "Bearer",
    expires_in: 3600,
    error: null,
  });

describe("enrichArtistSpotifyProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches the real profile and delegates to enrichSearchedArtistProfile", async () => {
    okToken();
    const spotifyArtist = {
      name: "Radiohead",
      followers: { total: 1800000 },
      images: [{ url: "https://i.scdn.co/image/x" }],
    };
    vi.mocked(getArtist).mockResolvedValue({ artist: spotifyArtist as never, error: null });

    await enrichArtistSpotifyProfile({ artistId, spotifyArtistId });

    expect(getArtist).toHaveBeenCalledWith(spotifyArtistId, "tok");
    expect(enrichSearchedArtistProfile).toHaveBeenCalledWith({
      artistId,
      spotifyArtistId,
      spotifyArtist,
    });
  });

  it("skips enrichment when the token cannot be minted", async () => {
    vi.mocked(generateAccessToken).mockResolvedValue({
      access_token: null,
      token_type: null,
      expires_in: null,
      error: new Error("down"),
    });

    await enrichArtistSpotifyProfile({ artistId, spotifyArtistId });

    expect(getArtist).not.toHaveBeenCalled();
    expect(enrichSearchedArtistProfile).not.toHaveBeenCalled();
  });

  it("skips enrichment when the Spotify profile fetch fails", async () => {
    okToken();
    vi.mocked(getArtist).mockResolvedValue({ artist: null, error: new Error("404") });

    await enrichArtistSpotifyProfile({ artistId, spotifyArtistId });

    expect(enrichSearchedArtistProfile).not.toHaveBeenCalled();
  });

  it("never throws (best-effort)", async () => {
    vi.mocked(generateAccessToken).mockRejectedValue(new Error("boom"));

    await expect(
      enrichArtistSpotifyProfile({ artistId, spotifyArtistId }),
    ).resolves.toBeUndefined();
  });
});
