import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { upsertRoom } from "../upsertRoom";

describe("upsertRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    mockUpsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
  });

  it("upserts a room and returns the data", async () => {
    const mockRoom = {
      id: "room-123",
      account_id: "account-456",
      topic: "Test Topic",
      artist_id: "artist-789",
      created_at: "2026-01-27T00:00:00Z",
    };
    mockSingle.mockResolvedValue({ data: mockRoom, error: null });

    const result = await upsertRoom({
      id: "room-123",
      account_id: "account-456",
      topic: "Test Topic",
      artist_id: "artist-789",
    });

    expect(mockFrom).toHaveBeenCalledWith("rooms");
    expect(mockUpsert).toHaveBeenCalledWith({
      id: "room-123",
      account_id: "account-456",
      topic: "Test Topic",
      artist_id: "artist-789",
    });
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(result).toEqual(mockRoom);
  });

  it("handles null artist_id", async () => {
    const mockRoom = {
      id: "room-123",
      account_id: "account-456",
      topic: "Test Topic",
      artist_id: null,
      created_at: "2026-01-27T00:00:00Z",
    };
    mockSingle.mockResolvedValue({ data: mockRoom, error: null });

    const result = await upsertRoom({
      id: "room-123",
      account_id: "account-456",
      topic: "Test Topic",
      artist_id: null,
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      id: "room-123",
      account_id: "account-456",
      topic: "Test Topic",
      artist_id: null,
    });
    expect(result).toEqual(mockRoom);
  });

  it("handles null topic", async () => {
    const mockRoom = {
      id: "room-123",
      account_id: "account-456",
      topic: null,
      artist_id: "artist-789",
      created_at: "2026-01-27T00:00:00Z",
    };
    mockSingle.mockResolvedValue({ data: mockRoom, error: null });

    const result = await upsertRoom({
      id: "room-123",
      account_id: "account-456",
      topic: null,
      artist_id: "artist-789",
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      id: "room-123",
      account_id: "account-456",
      topic: null,
      artist_id: "artist-789",
    });
    expect(result).toEqual(mockRoom);
  });

  it("throws an error when upsert fails", async () => {
    const mockError = { message: "Duplicate key violation", code: "23505" };
    mockSingle.mockResolvedValue({ data: null, error: mockError });

    await expect(
      upsertRoom({
        id: "room-123",
        account_id: "account-456",
        topic: "Test Topic",
        artist_id: "artist-789",
      }),
    ).rejects.toEqual(mockError);
  });

  it("updates existing room on conflict (upsert behavior)", async () => {
    const updatedRoom = {
      id: "room-123",
      account_id: "account-456",
      topic: "Updated Topic",
      artist_id: "artist-789",
      created_at: "2026-01-27T00:00:00Z",
    };
    mockSingle.mockResolvedValue({ data: updatedRoom, error: null });

    const result = await upsertRoom({
      id: "room-123",
      account_id: "account-456",
      topic: "Updated Topic",
      artist_id: "artist-789",
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      id: "room-123",
      account_id: "account-456",
      topic: "Updated Topic",
      artist_id: "artist-789",
    });
    expect(result.topic).toBe("Updated Topic");
  });
});
