import { describe, it, expect, vi, beforeEach } from "vitest";

import { linkSearchedArtistToAccount } from "../linkSearchedArtistToAccount";
import getArtist from "@/lib/spotify/getArtist";
import { createArtistInDb } from "@/lib/artists/createArtistInDb";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";

vi.mock("@/lib/spotify/getArtist", () => ({ default: vi.fn() }));
vi.mock("@/lib/artists/createArtistInDb", () => ({ createArtistInDb: vi.fn() }));
vi.mock("@/lib/artist/updateArtistSocials", () => ({ updateArtistSocials: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const spotifyArtistId = "4q3ewBCX7sLwd24euuV69X";
const accessToken = "spotify-app-token";
const createdArtistId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("linkSearchedArtistToAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getArtist).mockResolvedValue({
      artist: { id: spotifyArtistId, name: "Bad Bunny" } as never,
      error: null,
    });
    vi.mocked(createArtistInDb).mockResolvedValue({
      account_id: createdArtistId,
    } as never);
    vi.mocked(updateArtistSocials).mockResolvedValue([] as never);
  });

  it("creates the searched artist, attaches its Spotify social, and links it to the account", async () => {
    const result = await linkSearchedArtistToAccount({ accountId, spotifyArtistId, accessToken });

    expect(getArtist).toHaveBeenCalledWith(spotifyArtistId, accessToken);
    expect(createArtistInDb).toHaveBeenCalledWith("Bad Bunny", accountId);
    expect(updateArtistSocials).toHaveBeenCalledWith(createdArtistId, {
      SPOTIFY: `https://open.spotify.com/artist/${spotifyArtistId}`,
    });
    expect(result).toBe(createdArtistId);
  });

  it("returns null and links nothing when the Spotify artist can't be resolved", async () => {
    vi.mocked(getArtist).mockResolvedValue({ artist: null, error: new Error("boom") });

    const result = await linkSearchedArtistToAccount({ accountId, spotifyArtistId, accessToken });

    expect(result).toBeNull();
    expect(createArtistInDb).not.toHaveBeenCalled();
    expect(updateArtistSocials).not.toHaveBeenCalled();
  });

  it("returns null when the artist row could not be created", async () => {
    vi.mocked(createArtistInDb).mockResolvedValue(null);

    const result = await linkSearchedArtistToAccount({ accountId, spotifyArtistId, accessToken });

    expect(result).toBeNull();
    expect(updateArtistSocials).not.toHaveBeenCalled();
  });

  it("never throws — a failed social attach still resolves (best-effort)", async () => {
    vi.mocked(updateArtistSocials).mockRejectedValue(new Error("socials down"));

    await expect(
      linkSearchedArtistToAccount({ accountId, spotifyArtistId, accessToken }),
    ).resolves.toBeNull();
  });
});
