import { describe, it, expect, vi, beforeEach } from "vitest";

import { deleteArtist } from "../deleteArtist";
import { deleteAccountArtistId } from "@/lib/supabase/account_artist_ids/deleteAccountArtistId";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { deleteAccountById } from "@/lib/supabase/accounts/deleteAccountById";
import { selectSongArtists } from "@/lib/supabase/song_artists/selectSongArtists";

vi.mock("@/lib/supabase/account_artist_ids/deleteAccountArtistId", () => ({
  deleteAccountArtistId: vi.fn(),
}));

vi.mock("@/lib/supabase/account_artist_ids/getAccountArtistIds", () => ({
  getAccountArtistIds: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/deleteAccountById", () => ({
  deleteAccountById: vi.fn(),
}));

vi.mock("@/lib/supabase/song_artists/selectSongArtists", () => ({
  selectSongArtists: vi.fn(),
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
    expect(selectSongArtists).not.toHaveBeenCalled();
  });

  it("keeps the canonical account when the last link is removed but song dependencies exist", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([] as never);
    vi.mocked(selectSongArtists).mockResolvedValue([
      { id: "sa-1", song: "ISRC1", artist: artistId },
    ] as never);

    const result = await deleteArtist({ artistId, requesterAccountId });

    expect(result).toBe(artistId);
    expect(selectSongArtists).toHaveBeenCalledWith({ artists: [artistId] });
    expect(deleteAccountById).not.toHaveBeenCalled();
  });

  it("fails closed and keeps the canonical account when the dependency lookup errors", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([] as never);
    vi.mocked(selectSongArtists).mockResolvedValue(null);

    const result = await deleteArtist({ artistId, requesterAccountId });

    expect(result).toBe(artistId);
    expect(deleteAccountById).not.toHaveBeenCalled();
  });

  it("hard-deletes the account when the last link is removed and no dependencies exist", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([] as never);
    vi.mocked(selectSongArtists).mockResolvedValue([] as never);

    const result = await deleteArtist({ artistId, requesterAccountId });

    expect(result).toBe(artistId);
    expect(deleteAccountById).toHaveBeenCalledWith(artistId);
  });
});
