import { beforeEach, describe, expect, it, vi } from "vitest";

import { setAccountArtistPin } from "../setAccountArtistPin";

const mockFrom = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("setAccountArtistPin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ upsert: mockUpsert });
  });

  it("upserts the pinned state with the composite conflict target", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await setAccountArtistPin({
      accountId: "account-123",
      artistId: "artist-456",
      pinned: true,
    });

    expect(mockFrom).toHaveBeenCalledWith("account_artist_ids");
    expect(mockUpsert).toHaveBeenCalledWith(
      { account_id: "account-123", artist_id: "artist-456", pinned: true },
      { onConflict: "account_id,artist_id" },
    );
  });

  it("supports unpinning", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await setAccountArtistPin({
      accountId: "account-123",
      artistId: "artist-456",
      pinned: false,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      { account_id: "account-123", artist_id: "artist-456", pinned: false },
      { onConflict: "account_id,artist_id" },
    );
  });

  it("throws when the upsert fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "upsert exploded" } });

    await expect(
      setAccountArtistPin({
        accountId: "account-123",
        artistId: "artist-456",
        pinned: true,
      }),
    ).rejects.toThrow("Failed to update pinned status: upsert exploded");
  });
});
