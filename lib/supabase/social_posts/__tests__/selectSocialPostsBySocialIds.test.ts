import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectSocialPostsBySocialIds } from "../selectSocialPostsBySocialIds";

const rangeMock = vi.fn();
const inMock = vi.fn(() => ({ range: rangeMock }));
const selectMock = vi.fn(() => ({ in: inMock }));
const fromMock = vi.fn((_table: string) => ({ select: selectMock }));

vi.mock("../../serverClient", () => ({
  default: { from: (table: string) => fromMock(table) },
}));

describe("selectSocialPostsBySocialIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array without hitting supabase when socialIds is empty", async () => {
    const result = await selectSocialPostsBySocialIds([]);
    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("pages through 1000-row responses until a short page terminates", async () => {
    const makePage = (n: number, startIdx: number) =>
      Array.from({ length: n }, (_, i) => ({
        post_id: `p${startIdx + i}`,
        social_id: "s1",
      }));

    rangeMock
      .mockResolvedValueOnce({ data: makePage(1000, 0), error: null })
      .mockResolvedValueOnce({ data: makePage(500, 1000), error: null });

    const result = await selectSocialPostsBySocialIds(["s1"]);
    expect(result).toHaveLength(1500);
    expect(rangeMock).toHaveBeenCalledTimes(2);
    expect(rangeMock).toHaveBeenNthCalledWith(1, 0, 999);
    expect(rangeMock).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("chunks social_ids at 100 per `.in()` call", async () => {
    rangeMock.mockResolvedValue({ data: [], error: null });
    const ids = Array.from({ length: 250 }, (_, i) => `s${i}`);
    await selectSocialPostsBySocialIds(ids);
    expect(inMock).toHaveBeenCalledTimes(3);
    expect((inMock.mock.calls[0] as unknown[])[1]).toHaveLength(100);
    expect((inMock.mock.calls[2] as unknown[])[1]).toHaveLength(50);
  });

  it("throws when supabase returns an error", async () => {
    rangeMock.mockResolvedValue({ data: null, error: { message: "db fail" } });
    await expect(selectSocialPostsBySocialIds(["s1"])).rejects.toThrow(/db fail/);
  });
});
