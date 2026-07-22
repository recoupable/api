import { describe, it, expect, vi, beforeEach } from "vitest";

import { linkSearchedArtistToAccount } from "../linkSearchedArtistToAccount";
import { createArtistInDb } from "@/lib/artists/createArtistInDb";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";

vi.mock("@/lib/artists/createArtistInDb", () => ({ createArtistInDb: vi.fn() }));
vi.mock("@/lib/artist/updateArtistSocials", () => ({ updateArtistSocials: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const spotifyArtistId = "4q3ewBCX7sLwd24euuV69X";
const artistName = "Bad Bunny";
const createdArtistId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("linkSearchedArtistToAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createArtistInDb).mockResolvedValue({ account_id: createdArtistId } as never);
    vi.mocked(updateArtistSocials).mockResolvedValue([] as never);
  });

  it("creates the searched artist, attaches its Spotify social, and returns the new id", async () => {
    const result = await linkSearchedArtistToAccount({ accountId, spotifyArtistId, artistName });

    expect(createArtistInDb).toHaveBeenCalledWith(artistName, accountId);
    expect(updateArtistSocials).toHaveBeenCalledWith(createdArtistId, {
      SPOTIFY: `https://open.spotify.com/artist/${spotifyArtistId}`,
    });
    expect(result).toBe(createdArtistId);
  });

  it("returns null and links nothing when no artist name is provided", async () => {
    const result = await linkSearchedArtistToAccount({
      accountId,
      spotifyArtistId,
      artistName: "",
    });

    expect(result).toBeNull();
    expect(createArtistInDb).not.toHaveBeenCalled();
    expect(updateArtistSocials).not.toHaveBeenCalled();
  });

  it("returns null when the artist row could not be created", async () => {
    vi.mocked(createArtistInDb).mockResolvedValue(null);

    const result = await linkSearchedArtistToAccount({ accountId, spotifyArtistId, artistName });

    expect(result).toBeNull();
    expect(updateArtistSocials).not.toHaveBeenCalled();
  });

  it("never throws — a failed social attach still resolves (best-effort)", async () => {
    vi.mocked(updateArtistSocials).mockRejectedValue(new Error("socials down"));

    await expect(
      linkSearchedArtistToAccount({ accountId, spotifyArtistId, artistName }),
    ).resolves.toBeNull();
  });
});
