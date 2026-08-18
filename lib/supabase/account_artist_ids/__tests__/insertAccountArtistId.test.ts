import { describe, it, expect, vi, beforeEach } from "vitest";

import { insertAccountArtistId } from "../insertAccountArtistId";

const mockFrom = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("insertAccountArtistId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("upserts the account-artist link on the (account_id, artist_id) pair", async () => {
    await insertAccountArtistId("account-456", "artist-789");

    expect(mockFrom).toHaveBeenCalledWith("account_artist_ids");
    expect(mockUpsert).toHaveBeenCalledWith(
      { account_id: "account-456", artist_id: "artist-789" },
      { onConflict: "account_id,artist_id", ignoreDuplicates: true },
    );
  });

  it("passes pinned through when provided", async () => {
    await insertAccountArtistId("account-456", "artist-789", { pinned: true });

    expect(mockUpsert).toHaveBeenCalledWith(
      { account_id: "account-456", artist_id: "artist-789", pinned: true },
      { onConflict: "account_id,artist_id", ignoreDuplicates: true },
    );
  });

  it("resolves when the pair is already linked (conflict ignored)", async () => {
    // ignoreDuplicates: a conflicting upsert is a silent no-op, not an error.
    mockUpsert.mockResolvedValue({ error: null });

    await expect(insertAccountArtistId("account-456", "artist-789")).resolves.toBeUndefined();
  });

  it("throws when the upsert fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "Upsert failed" } });

    await expect(insertAccountArtistId("account-456", "artist-789")).rejects.toThrow(
      "Failed to upsert account-artist relationship: Upsert failed",
    );
  });
});
