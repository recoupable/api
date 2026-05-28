import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectMemoriesByRoomId } from "@/lib/supabase/memories/selectMemoriesByRoomId";

const selectChain = vi.fn();
const eqChain = vi.fn();
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
  selectChain.mockReturnValue({ eq: eqChain });
  eqChain.mockReturnValue({ order: orderChain1 });
  orderChain1.mockReturnValue({ order: orderChain2 });
  orderChain2.mockReturnValue({ range: rangeChain });
});

describe("selectMemoriesByRoomId", () => {
  it("returns a single page when fewer than PAGE_SIZE rows come back", async () => {
    rangeChain.mockResolvedValueOnce({
      data: [{ id: "m1" }, { id: "m2" }],
      error: null,
    });

    const memories = await selectMemoriesByRoomId("room-1");

    expect(memories).toEqual([{ id: "m1" }, { id: "m2" }]);
    expect(eqChain).toHaveBeenCalledWith("room_id", "room-1");
    expect(rangeChain).toHaveBeenCalledTimes(1);
    expect(rangeChain).toHaveBeenCalledWith(0, 999);
  });

  it("paginates until a short page is returned", async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({ id: `m${i}` }));
    rangeChain
      .mockResolvedValueOnce({ data: fullPage, error: null })
      .mockResolvedValueOnce({ data: [{ id: "last" }], error: null });

    const memories = await selectMemoriesByRoomId("room-1");

    expect(memories).toHaveLength(1001);
    expect(rangeChain).toHaveBeenCalledTimes(2);
    expect(rangeChain).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("throws when supabase returns an error", async () => {
    rangeChain.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    await expect(selectMemoriesByRoomId("room-1")).rejects.toEqual({
      message: "boom",
    });
  });
});
