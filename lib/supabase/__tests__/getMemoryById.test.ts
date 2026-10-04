import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));

vi.mock("../serverClient", () => ({
  default: {
    from: vi.fn(() => ({ select: mockSelect })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ single: mockSingle });
});

describe("getMemoryById", () => {
  it("returns memory when found", async () => {
    const memory = { id: "mem-1", room_id: "room-1", content: "hello" };
    mockSingle.mockResolvedValue({ data: memory, error: null });

    const { getMemoryById } = await import("../getMemoryById");
    const result = await getMemoryById({ id: "mem-1" });

    expect(result).toEqual(memory);
    expect(mockEq).toHaveBeenCalledWith("id", "mem-1");
  });

  it("throws when supabase returns error", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });

    const { getMemoryById } = await import("../getMemoryById");

    await expect(getMemoryById({ id: "bad-id" })).rejects.toEqual({ message: "not found" });
  });
});
