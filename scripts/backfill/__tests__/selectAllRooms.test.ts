import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAllRooms } from "@/scripts/backfill/selectAllRooms";
import { selectRooms } from "@/lib/supabase/rooms/selectRooms";

vi.mock("@/lib/supabase/rooms/selectRooms", () => ({ selectRooms: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("selectAllRooms", () => {
  it("returns a single short page without a second query", async () => {
    vi.mocked(selectRooms).mockResolvedValueOnce([{ id: "r1" }, { id: "r2" }] as any);

    const rooms = await selectAllRooms();

    expect(rooms).toHaveLength(2);
    expect(selectRooms).toHaveBeenCalledTimes(1);
    expect(selectRooms).toHaveBeenCalledWith({ range: { from: 0, to: 999 } });
  });

  it("pages through the PostgREST 1,000-row cap until a short page", async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}` }));
    vi.mocked(selectRooms)
      .mockResolvedValueOnce(fullPage as any)
      .mockResolvedValueOnce([{ id: "r1000" }] as any);

    const rooms = await selectAllRooms();

    expect(rooms).toHaveLength(1001);
    expect(selectRooms).toHaveBeenCalledTimes(2);
    expect(selectRooms).toHaveBeenNthCalledWith(2, { range: { from: 1000, to: 1999 } });
  });

  it("treats a null result as an empty page", async () => {
    vi.mocked(selectRooms).mockResolvedValueOnce(null as any);

    const rooms = await selectAllRooms();

    expect(rooms).toEqual([]);
    expect(selectRooms).toHaveBeenCalledTimes(1);
  });
});
