import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGte = vi.fn();
const mockEq = vi.fn(() => ({ gte: mockGte }));
const mockDelete = vi.fn(() => ({ eq: mockEq }));

vi.mock("../serverClient", () => ({
  default: {
    from: vi.fn(() => ({ delete: mockDelete })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockDelete.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ gte: mockGte });
});

describe("deleteMemoriesByRoomIdAfterTimestamp", () => {
  it("deletes memories and returns count", async () => {
    mockGte.mockResolvedValue({ error: null, count: 3 });

    const { deleteMemoriesByRoomIdAfterTimestamp } = await import(
      "../deleteMemoriesByRoomIdAfterTimestamp"
    );

    const result = await deleteMemoriesByRoomIdAfterTimestamp({
      roomId: "room-1",
      timestamp: new Date("2026-01-01T00:00:00Z"),
    });

    expect(result).toBe(3);
    expect(mockDelete).toHaveBeenCalledWith({ count: "exact" });
    expect(mockEq).toHaveBeenCalledWith("room_id", "room-1");
    expect(mockGte).toHaveBeenCalledWith("updated_at", "2026-01-01T00:00:00.000Z");
  });

  it("throws when supabase returns error", async () => {
    mockGte.mockResolvedValue({ error: { message: "db error" }, count: null });

    const { deleteMemoriesByRoomIdAfterTimestamp } = await import(
      "../deleteMemoriesByRoomIdAfterTimestamp"
    );

    await expect(
      deleteMemoriesByRoomIdAfterTimestamp({
        roomId: "room-1",
        timestamp: new Date("2026-01-01T00:00:00Z"),
      }),
    ).rejects.toEqual({ message: "db error" });
  });
});
