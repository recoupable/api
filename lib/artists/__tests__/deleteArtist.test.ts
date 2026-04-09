import { describe, it, expect, vi, beforeEach } from "vitest";

import { deleteArtist } from "../deleteArtist";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { checkAccountArtistAccess } from "../checkAccountArtistAccess";
import { deleteAccountArtistId } from "@/lib/supabase/account_artist_ids/deleteAccountArtistId";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { deleteAccountById } from "@/lib/supabase/accounts/deleteAccountById";

vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: vi.fn(),
}));

vi.mock("../checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/account_artist_ids/deleteAccountArtistId", () => ({
  deleteAccountArtistId: vi.fn(),
}));

vi.mock("@/lib/supabase/account_artist_ids/getAccountArtistIds", () => ({
  getAccountArtistIds: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/deleteAccountById", () => ({
  deleteAccountById: vi.fn(),
}));

describe("deleteArtist", () => {
  const requesterAccountId = "660e8400-e29b-41d4-a716-446655440000";
  const artistId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found when the artist account does not exist", async () => {
    vi.mocked(selectAccounts).mockResolvedValue([]);

    const result = await deleteArtist({
      artistId,
      requesterAccountId,
    });

    expect(result).toEqual({
      ok: false,
      code: "not_found",
    });
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });

  it("returns forbidden when the requester cannot access the artist", async () => {
    vi.mocked(selectAccounts).mockResolvedValue([{ id: artistId }] as never);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const result = await deleteArtist({
      artistId,
      requesterAccountId,
    });

    expect(result).toEqual({
      ok: false,
      code: "forbidden",
    });
    expect(deleteAccountArtistId).not.toHaveBeenCalled();
  });

  it("returns forbidden when the requester has access but no direct artist link to delete", async () => {
    vi.mocked(selectAccounts).mockResolvedValue([{ id: artistId }] as never);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(deleteAccountArtistId).mockResolvedValue([]);

    const result = await deleteArtist({
      artistId,
      requesterAccountId,
    });

    expect(result).toEqual({
      ok: false,
      code: "forbidden",
    });
    expect(getAccountArtistIds).not.toHaveBeenCalled();
  });

  it("removes only the requester link when other links still exist", async () => {
    vi.mocked(selectAccounts).mockResolvedValue([{ id: artistId }] as never);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(deleteAccountArtistId).mockResolvedValue([
      { account_id: requesterAccountId, artist_id: artistId },
    ] as never);
    vi.mocked(getAccountArtistIds).mockResolvedValue([{ artist_id: artistId }] as never);

    const result = await deleteArtist({
      artistId,
      requesterAccountId,
    });

    expect(result).toEqual({
      ok: true,
      artistId,
    });
    expect(deleteAccountById).not.toHaveBeenCalled();
  });

  it("deletes the artist account when no links remain", async () => {
    vi.mocked(selectAccounts).mockResolvedValue([{ id: artistId }] as never);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(deleteAccountArtistId).mockResolvedValue([
      { account_id: requesterAccountId, artist_id: artistId },
    ] as never);
    vi.mocked(getAccountArtistIds).mockResolvedValue([]);
    vi.mocked(deleteAccountById).mockResolvedValue(true);

    const result = await deleteArtist({
      artistId,
      requesterAccountId,
    });

    expect(result).toEqual({
      ok: true,
      artistId,
    });
    expect(deleteAccountById).toHaveBeenCalledWith(artistId);
  });
});
