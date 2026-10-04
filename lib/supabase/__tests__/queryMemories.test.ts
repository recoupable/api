import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

vi.mock("../serverClient", () => ({
  default: {
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ order: mockOrder });
  mockOrder.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue({ data: [], error: null });
  mockOrder.mockResolvedValue({ data: [], error: null });
});

describe("queryMemories", () => {
  it("queries memories by roomId with ascending order", async () => {
    const { default: queryMemories } = await import("../queryMemories");

    await queryMemories("room-123", { ascending: true });

    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockEq).toHaveBeenCalledWith("room_id", "room-123");
    expect(mockOrder).toHaveBeenCalledWith("updated_at", { ascending: true });
  });

  it("defaults to descending order", async () => {
    const { default: queryMemories } = await import("../queryMemories");

    await queryMemories("room-123");

    expect(mockOrder).toHaveBeenCalledWith("updated_at", { ascending: false });
  });

  it("applies limit when provided", async () => {
    const { default: queryMemories } = await import("../queryMemories");

    await queryMemories("room-123", { limit: 10 });

    expect(mockLimit).toHaveBeenCalledWith(10);
  });
});
