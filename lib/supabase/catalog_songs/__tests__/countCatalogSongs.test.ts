import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock, selectMock, eqMock } = vi.hoisted(() => {
  const eqMock = vi.fn();
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  return { fromMock, selectMock, eqMock };
});

vi.mock("../../serverClient", () => ({ default: { from: fromMock } }));

const { countCatalogSongs } = await import("@/lib/supabase/catalog_songs/countCatalogSongs");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("countCatalogSongs", () => {
  it("returns a count per catalog id from head-count queries", async () => {
    eqMock
      .mockResolvedValueOnce({ count: 24, error: null })
      .mockResolvedValueOnce({ count: 4, error: null });

    const counts = await countCatalogSongs(["cat_1", "cat_2"]);

    expect(counts).toEqual({ cat_1: 24, cat_2: 4 });
    expect(fromMock).toHaveBeenCalledWith("catalog_songs");
    expect(selectMock).toHaveBeenCalledWith("*", { count: "exact", head: true });
  });

  it("returns an empty record for no ids without querying", async () => {
    expect(await countCatalogSongs([])).toEqual({});
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("treats a failed count as 0 rather than failing the profile", async () => {
    eqMock.mockResolvedValueOnce({ count: null, error: { message: "boom" } });

    expect(await countCatalogSongs(["cat_1"])).toEqual({ cat_1: 0 });
  });
});
