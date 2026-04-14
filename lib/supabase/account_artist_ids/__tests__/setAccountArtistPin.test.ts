import { beforeEach, describe, expect, it, vi } from "vitest";

import { setAccountArtistPin } from "../setAccountArtistPin";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockSelectEqAccount = vi.fn();
const mockSelectEqArtist = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

/**
 * Wires the select().eq().eq().maybeSingle() chain used by setAccountArtistPin
 * to resolve with the supplied data/error result.
 *
 * @param maybeSingleResult - Result payload the final maybeSingle() should resolve with
 * @param maybeSingleResult.data - The row data (or null) returned by the supabase query chain
 * @param maybeSingleResult.error - The error (or null) returned by the supabase query chain
 */
function wireSelect(maybeSingleResult: { data: unknown; error: unknown }) {
  mockMaybeSingle.mockResolvedValue(maybeSingleResult);
  mockSelectEqArtist.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockSelectEqAccount.mockReturnValue({ eq: mockSelectEqArtist });
  mockSelect.mockReturnValue({ eq: mockSelectEqAccount });
}

describe("setAccountArtistPin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
      insert: mockInsert,
    });
  });

  it("updates the existing row when one is found", async () => {
    wireSelect({ data: { id: 42 }, error: null });

    await setAccountArtistPin({
      accountId: "account-123",
      artistId: "artist-456",
      pinned: true,
    });

    expect(mockFrom).toHaveBeenCalledWith("account_artist_ids");
    expect(mockSelect).toHaveBeenCalledWith("id");
    expect(mockSelectEqAccount).toHaveBeenCalledWith("account_id", "account-123");
    expect(mockSelectEqArtist).toHaveBeenCalledWith("artist_id", "artist-456");
    expect(mockUpdate).toHaveBeenCalledWith({ pinned: true });
    expect(mockUpdateEq).toHaveBeenCalledWith("id", 42);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts a new row when none exists (org-access first pin)", async () => {
    wireSelect({ data: null, error: null });

    await setAccountArtistPin({
      accountId: "account-123",
      artistId: "artist-456",
      pinned: true,
    });

    expect(mockInsert).toHaveBeenCalledWith({
      account_id: "account-123",
      artist_id: "artist-456",
      pinned: true,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("supports unpinning via update", async () => {
    wireSelect({ data: { id: 42 }, error: null });

    await setAccountArtistPin({
      accountId: "account-123",
      artistId: "artist-456",
      pinned: false,
    });

    expect(mockUpdate).toHaveBeenCalledWith({ pinned: false });
  });

  it("throws when the select fails", async () => {
    wireSelect({ data: null, error: { message: "select exploded" } });

    await expect(
      setAccountArtistPin({
        accountId: "account-123",
        artistId: "artist-456",
        pinned: true,
      }),
    ).rejects.toThrow("Failed to update pinned status: select exploded");
  });

  it("throws when the update fails", async () => {
    wireSelect({ data: { id: 42 }, error: null });
    mockUpdateEq.mockResolvedValue({ error: { message: "update exploded" } });

    await expect(
      setAccountArtistPin({
        accountId: "account-123",
        artistId: "artist-456",
        pinned: true,
      }),
    ).rejects.toThrow("Failed to update pinned status: update exploded");
  });

  it("throws when the insert fails", async () => {
    wireSelect({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: { message: "insert exploded" } });

    await expect(
      setAccountArtistPin({
        accountId: "account-123",
        artistId: "artist-456",
        pinned: true,
      }),
    ).rejects.toThrow("Failed to update pinned status: insert exploded");
  });
});
