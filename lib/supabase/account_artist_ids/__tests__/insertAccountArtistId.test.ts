import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { insertAccountArtistId } from "../insertAccountArtistId";

describe("insertAccountArtistId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
  });

  it("inserts an account-artist relationship and returns the data", async () => {
    const mockData = {
      id: "rel-123",
      account_id: "account-456",
      artist_id: "artist-789",
    };
    mockSingle.mockResolvedValue({ data: mockData, error: null });

    const result = await insertAccountArtistId("account-456", "artist-789");

    expect(mockFrom).toHaveBeenCalledWith("account_artist_ids");
    expect(mockInsert).toHaveBeenCalledWith({
      account_id: "account-456",
      artist_id: "artist-789",
    });
    expect(result).toEqual(mockData);
  });

  it("throws an error when insert fails", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Insert failed" },
    });

    await expect(insertAccountArtistId("account-456", "artist-789")).rejects.toThrow(
      "Failed to insert account-artist relationship: Insert failed",
    );
  });

  it("throws an error when no data is returned", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    await expect(insertAccountArtistId("account-456", "artist-789")).rejects.toThrow(
      "Failed to insert account-artist relationship: No data returned",
    );
  });
});
