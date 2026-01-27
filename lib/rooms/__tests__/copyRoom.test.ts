import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelectRoom = vi.fn();
const mockUpsertRoom = vi.fn();

vi.mock("@/lib/supabase/rooms/selectRoom", () => ({
  default: (...args: unknown[]) => mockSelectRoom(...args),
}));

vi.mock("@/lib/supabase/rooms/upsertRoom", () => ({
  upsertRoom: (...args: unknown[]) => mockUpsertRoom(...args),
}));

vi.mock("@/lib/uuid/generateUUID", () => ({
  default: () => "generated-uuid-123",
}));

import { copyRoom } from "../copyRoom";

describe("copyRoom", () => {
  const mockSourceRoom = {
    id: "source-room-123",
    account_id: "account-456",
    artist_id: "old-artist-789",
    topic: "Original Conversation",
  };

  const mockNewRoom = {
    id: "generated-uuid-123",
    account_id: "account-456",
    artist_id: "new-artist-999",
    topic: "Original Conversation",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copies a room to a new artist", async () => {
    mockSelectRoom.mockResolvedValue(mockSourceRoom);
    mockUpsertRoom.mockResolvedValue(mockNewRoom);

    const result = await copyRoom("source-room-123", "new-artist-999");

    expect(mockSelectRoom).toHaveBeenCalledWith("source-room-123");
    expect(mockUpsertRoom).toHaveBeenCalledWith({
      id: "generated-uuid-123",
      account_id: "account-456",
      artist_id: "new-artist-999",
      topic: "Original Conversation",
    });
    expect(result).toBe("generated-uuid-123");
  });

  it("uses default topic when source room has no topic", async () => {
    mockSelectRoom.mockResolvedValue({ ...mockSourceRoom, topic: null });
    mockUpsertRoom.mockResolvedValue(mockNewRoom);

    await copyRoom("source-room-123", "new-artist-999");

    expect(mockUpsertRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "New conversation",
      }),
    );
  });

  it("returns null when source room is not found", async () => {
    mockSelectRoom.mockResolvedValue(null);

    const result = await copyRoom("nonexistent-room", "new-artist-999");

    expect(result).toBeNull();
    expect(mockUpsertRoom).not.toHaveBeenCalled();
  });

  it("returns null when room insertion fails", async () => {
    mockSelectRoom.mockResolvedValue(mockSourceRoom);
    mockUpsertRoom.mockRejectedValue(new Error("Insert failed"));

    const result = await copyRoom("source-room-123", "new-artist-999");

    expect(result).toBeNull();
  });
});
