import { beforeEach, describe, expect, it, vi } from "vitest";

import { upsertAccountArtistPin } from "../upsertAccountArtistPin";

const mockFrom = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("upsertAccountArtistPin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ upsert: mockUpsert });
  });

  it("upserts the pinned state for the account and artist", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await upsertAccountArtistPin({
      accountId: "account-123",
      artistId: "artist-456",
      pinned: true,
    });

    expect(mockFrom).toHaveBeenCalledWith("account_artist_ids");
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        account_id: "account-123",
        artist_id: "artist-456",
        pinned: true,
      },
      { onConflict: "account_id,artist_id" },
    );
  });

  it("throws when the upsert fails", async () => {
    mockUpsert.mockResolvedValue({
      error: { message: "database exploded" },
    });

    await expect(
      upsertAccountArtistPin({
        accountId: "account-123",
        artistId: "artist-456",
        pinned: false,
      }),
    ).rejects.toThrow("Failed to update pinned status: database exploded");
  });
});
