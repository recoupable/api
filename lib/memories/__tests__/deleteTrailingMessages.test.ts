import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetMemoryById = vi.fn();
vi.mock("@/lib/supabase/getMemoryById", () => ({
  getMemoryById: (...args: unknown[]) => mockGetMemoryById(...args),
}));

const mockDeleteMemories = vi.fn();
vi.mock("@/lib/supabase/deleteMemoriesByRoomIdAfterTimestamp", () => ({
  deleteMemoriesByRoomIdAfterTimestamp: (...args: unknown[]) => mockDeleteMemories(...args),
}));

const { deleteTrailingMessages } = await import("../deleteTrailingMessages");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteTrailingMessages", () => {
  it("deletes memories after the given memory's timestamp", async () => {
    mockGetMemoryById.mockResolvedValue({
      id: "mem-1",
      room_id: "room-1",
      updated_at: "2026-01-01T12:00:00Z",
    });
    mockDeleteMemories.mockResolvedValue(2);

    await deleteTrailingMessages({ id: "mem-1" });

    expect(mockGetMemoryById).toHaveBeenCalledWith({ id: "mem-1" });
    expect(mockDeleteMemories).toHaveBeenCalledWith({
      roomId: "room-1",
      timestamp: new Date("2026-01-01T12:00:00Z"),
    });
  });

  it("throws when memory not found", async () => {
    mockGetMemoryById.mockResolvedValue(null);

    await expect(deleteTrailingMessages({ id: "bad" })).rejects.toThrow("Memory not found");
  });

  it("throws when memory has no room_id", async () => {
    mockGetMemoryById.mockResolvedValue({ id: "mem-1", room_id: null, updated_at: "2026-01-01" });

    await expect(deleteTrailingMessages({ id: "mem-1" })).rejects.toThrow("Room ID not found");
  });
});
