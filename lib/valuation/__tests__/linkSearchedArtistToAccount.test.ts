import { describe, it, expect, vi, beforeEach } from "vitest";

import { linkSearchedArtistToAccount } from "../linkSearchedArtistToAccount";
import { createArtistInDb } from "@/lib/artists/createArtistInDb";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";
import { findCanonicalArtistBySpotifyId } from "@/lib/valuation/findCanonicalArtistBySpotifyId";
import { selectAccountArtistId } from "@/lib/supabase/account_artist_ids/selectAccountArtistId";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";

vi.mock("@/lib/artists/createArtistInDb", () => ({ createArtistInDb: vi.fn() }));
vi.mock("@/lib/artist/updateArtistSocials", () => ({ updateArtistSocials: vi.fn() }));
vi.mock("@/lib/valuation/findCanonicalArtistBySpotifyId", () => ({
  findCanonicalArtistBySpotifyId: vi.fn(),
}));
vi.mock("@/lib/supabase/account_artist_ids/selectAccountArtistId", () => ({
  selectAccountArtistId: vi.fn(),
}));
vi.mock("@/lib/supabase/account_artist_ids/insertAccountArtistId", () => ({
  insertAccountArtistId: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const spotifyArtistId = "4q3ewBCX7sLwd24euuV69X";
const artistName = "Bad Bunny";
const createdArtistId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("linkSearchedArtistToAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createArtistInDb).mockResolvedValue({ account_id: createdArtistId } as never);
    vi.mocked(updateArtistSocials).mockResolvedValue([] as never);
    vi.mocked(findCanonicalArtistBySpotifyId).mockResolvedValue(null);
    vi.mocked(selectAccountArtistId).mockResolvedValue(null as never);
    vi.mocked(insertAccountArtistId).mockResolvedValue(undefined as never);
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
  // Artists are canonical and shared (chat#1866). Creating a second one for a
  // Spotify id that already exists is what duplicated every cold-start signup's
  // roster (chat#1889 row 8).
  it("rosters the existing canonical artist instead of creating a duplicate", async () => {
    vi.mocked(findCanonicalArtistBySpotifyId).mockResolvedValue("canonical-1");

    const result = await linkSearchedArtistToAccount({ accountId, spotifyArtistId, artistName });

    expect(createArtistInDb).not.toHaveBeenCalled();
    expect(insertAccountArtistId).toHaveBeenCalledWith(accountId, "canonical-1");
    expect(result).toBe("canonical-1");
  });

  it("does not re-link a canonical artist the account already rosters", async () => {
    vi.mocked(findCanonicalArtistBySpotifyId).mockResolvedValue("canonical-1");
    vi.mocked(selectAccountArtistId).mockResolvedValue({ id: "link-1" } as never);

    const result = await linkSearchedArtistToAccount({ accountId, spotifyArtistId, artistName });

    expect(insertAccountArtistId).not.toHaveBeenCalled();
    expect(result).toBe("canonical-1");
  });
});
