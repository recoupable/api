import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAllRooms } from "@/lib/supabase/rooms/selectAllRooms";

const selectChain = vi.fn();
const orderChain1 = vi.fn();
const orderChain2 = vi.fn();
const rangeChain = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({ select: selectChain })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  selectChain.mockReturnValue({ order: orderChain1 });
  orderChain1.mockReturnValue({ order: orderChain2 });
  orderChain2.mockReturnValue({ range: rangeChain });
});

describe("selectAllRooms", () => {
  it("returns a single page when fewer than PAGE_SIZE rows come back", async () => {
    rangeChain.mockResolvedValueOnce({
      data: [{ id: "r1" }, { id: "r2" }],
      error: null,
    });

    const rooms = await selectAllRooms();

    expect(rooms).toEqual([{ id: "r1" }, { id: "r2" }]);
    expect(rangeChain).toHaveBeenCalledTimes(1);
    expect(rangeChain).toHaveBeenCalledWith(0, 999);
  });

  it("paginates until a short page is returned", async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}` }));
    rangeChain
      .mockResolvedValueOnce({ data: fullPage, error: null })
      .mockResolvedValueOnce({ data: [{ id: "last" }], error: null });

    const rooms = await selectAllRooms();

    expect(rooms).toHaveLength(1001);
    expect(rangeChain).toHaveBeenCalledTimes(2);
    expect(rangeChain).toHaveBeenNthCalledWith(1, 0, 999);
    expect(rangeChain).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("throws when supabase returns an error", async () => {
    rangeChain.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    await expect(selectAllRooms()).rejects.toEqual({ message: "boom" });
  });
});
