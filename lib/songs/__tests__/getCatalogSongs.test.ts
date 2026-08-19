import { describe, it, expect, vi, beforeEach } from "vitest";

const { selectCatalogSongsMock } = vi.hoisted(() => ({
  selectCatalogSongsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/catalog_songs/selectCatalogSongs", () => ({
  selectCatalogSongs: selectCatalogSongsMock,
}));

const { getCatalogSongs } = await import("@/lib/songs/getCatalogSongs");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCatalogSongs", () => {
  it("chunks large ISRC lists and concatenates the rows", async () => {
    const isrcs = Array.from({ length: 250 }, (_, i) => `ISRC${i}`);
    selectCatalogSongsMock.mockImplementation(async (chunk: string[]) =>
      chunk.map(song => ({ catalog: "CAT1", song })),
    );

    const rows = await getCatalogSongs(isrcs);

    expect(selectCatalogSongsMock).toHaveBeenCalledTimes(2);
    expect(selectCatalogSongsMock.mock.calls[0][0]).toHaveLength(200);
    expect(selectCatalogSongsMock.mock.calls[1][0]).toHaveLength(50);
    expect(rows).toHaveLength(250);
    expect(rows[0]).toEqual({ catalog: "CAT1", song: "ISRC0" });
  });

  it("returns [] for no ISRCs without querying", async () => {
    expect(await getCatalogSongs([])).toEqual([]);
    expect(selectCatalogSongsMock).not.toHaveBeenCalled();
  });
});
