import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock, selectMock, inMock } = vi.hoisted(() => {
  const inMock = vi.fn();
  const selectMock = vi.fn(() => ({ in: inMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  return { fromMock, selectMock, inMock };
});

vi.mock("../../serverClient", () => ({ default: { from: fromMock } }));

const { selectCatalogsBySongs } = await import(
  "@/lib/supabase/catalog_songs/selectCatalogsBySongs"
);

const cat = (id: string) => ({ id, name: `Catalog ${id}`, updated_at: "2026-08-01" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("selectCatalogsBySongs", () => {
  it("returns catalogs deduped across song rows", async () => {
    inMock.mockResolvedValue({
      data: [
        { catalog: "c1", catalogs: cat("c1") },
        { catalog: "c1", catalogs: cat("c1") },
        { catalog: "c2", catalogs: cat("c2") },
      ],
      error: null,
    });

    const result = await selectCatalogsBySongs(["ISRC1", "ISRC2", "ISRC3"]);
    expect(result.map(c => c.id)).toEqual(["c1", "c2"]);
    expect(selectMock).toHaveBeenCalledWith("catalog, catalogs!inner (id, name, updated_at)");
    expect(inMock).toHaveBeenCalledTimes(1);
  });

  it("chunks large ISRC lists and dedupes across chunks", async () => {
    inMock.mockResolvedValue({ data: [{ catalog: "c1", catalogs: cat("c1") }], error: null });

    const isrcs = Array.from({ length: 401 }, (_, i) => `ISRC${i}`);
    const result = await selectCatalogsBySongs(isrcs);

    expect(inMock).toHaveBeenCalledTimes(3);
    expect(inMock.mock.calls[0][1]).toHaveLength(200);
    expect(inMock.mock.calls[2][1]).toHaveLength(1);
    expect(result).toHaveLength(1);
  });

  it("returns [] for no ISRCs without querying", async () => {
    expect(await selectCatalogsBySongs([])).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("throws on a query error", async () => {
    inMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(selectCatalogsBySongs(["ISRC1"])).rejects.toThrow(/boom/);
  });
});
