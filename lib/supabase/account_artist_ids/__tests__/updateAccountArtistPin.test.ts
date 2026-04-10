import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateAccountArtistPin } from "../updateAccountArtistPin";

const mockFrom = vi.fn();
const mockUpdate = vi.fn();
const mockEqAccount = vi.fn();
const mockEqArtist = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("updateAccountArtistPin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ update: mockUpdate });
    mockUpdate.mockReturnValue({ eq: mockEqAccount });
    mockEqAccount.mockReturnValue({ eq: mockEqArtist });
  });

  it("updates the pinned state for an existing account/artist row", async () => {
    mockEqArtist.mockResolvedValue({ error: null });

    await updateAccountArtistPin("account-123", "artist-456", true);

    expect(mockFrom).toHaveBeenCalledWith("account_artist_ids");
    expect(mockUpdate).toHaveBeenCalledWith({ pinned: true });
    expect(mockEqAccount).toHaveBeenCalledWith("account_id", "account-123");
    expect(mockEqArtist).toHaveBeenCalledWith("artist_id", "artist-456");
  });

  it("throws when the update fails", async () => {
    mockEqArtist.mockResolvedValue({
      error: { message: "update exploded" },
    });

    await expect(updateAccountArtistPin("account-123", "artist-456", false)).rejects.toThrow(
      "Failed to update pinned status: update exploded",
    );
  });
});
