import { describe, it, expect, vi, beforeEach } from "vitest";

import { deleteArtist } from "../deleteArtist";
import { deleteAccountArtistId } from "@/lib/supabase/account_artist_ids/deleteAccountArtistId";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { deleteAccountById } from "@/lib/supabase/accounts/deleteAccountById";
import { getSongArtistExistsByArtist } from "@/lib/supabase/song_artists/getSongArtistExistsByArtist";

vi.mock("@/lib/supabase/account_artist_ids/deleteAccountArtistId", () => ({
  deleteAccountArtistId: vi.fn(),
}));

vi.mock("@/lib/supabase/account_artist_ids/getAccountArtistIds", () => ({
  getAccountArtistIds: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/deleteAccountById", () => ({
  deleteAccountById: vi.fn(),
}));

vi.mock("@/lib/supabase/song_artists/getSongArtistExistsByArtist", () => ({
  getSongArtistExistsByArtist: vi.fn(),
}));

describe("deleteArtist", () => {
  const artistId = "550e8400-e29b-41d4-a716-446655440000";
  const requesterAccountId = "660e8400-e29b-41d4-a716-446655440000";
  const link = { account_id: requesterAccountId, artist_id: artistId };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteAccountArtistId).mockResolvedValue([link] as never);
    vi.mocked(deleteAccountById).mockResolvedValue(undefined as never);
  });

  it("throws when the requester link could not be deleted", async () => {
    vi.mocked(deleteAccountArtistId).mockResolvedValue([] as never);

    await expect(deleteArtist({ artistId, requesterAccountId })).rejects.toThrow(
      "Failed to delete artist link",
    );
    expect(deleteAccountById).not.toHaveBeenCalled();
  });

  it("does not hard-delete when other roster links remain", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([
      { account_id: "another-account", artist_id: artistId },
    ] as never);

    const result = await deleteArtist({ artistId, requesterAccountId });

    expect(result).toBe(artistId);
    expect(deleteAccountById).not.toHaveBeenCalled();
    expect(getSongArtistExistsByArtist).not.toHaveBeenCalled();
  });

  it("keeps the canonical account when the last link is removed but song dependencies exist", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([] as never);
    vi.mocked(getSongArtistExistsByArtist).mockResolvedValue(true);

    const result = await deleteArtist({ artistId, requesterAccountId });

    expect(result).toBe(artistId);
    expect(getSongArtistExistsByArtist).toHaveBeenCalledWith(artistId);
    expect(deleteAccountById).not.toHaveBeenCalled();
  });

  it("hard-deletes the account when the last link is removed and no dependencies exist", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([] as never);
    vi.mocked(getSongArtistExistsByArtist).mockResolvedValue(false);

    const result = await deleteArtist({ artistId, requesterAccountId });

    expect(result).toBe(artistId);
    expect(deleteAccountById).toHaveBeenCalledWith(artistId);
  });
});
