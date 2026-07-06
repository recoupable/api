import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectCatalogSongTitles } from "../selectCatalogSongTitles";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return { default: { from: mockFrom } };
});

function mockBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (resolve: (v: unknown) => void) => void;
  } = {} as never;
  for (const m of ["select", "eq"]) builder[m] = vi.fn().mockReturnValue(builder);
  builder.then = resolve => resolve(result);
  vi.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}

describe("selectCatalogSongTitles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns isrc + title pairs for the catalog's songs", async () => {
    const builder = mockBuilder({
      data: [
        { songs: { isrc: "ISRC1", name: "Song One" } },
        { songs: { isrc: "ISRC2", name: null } },
      ],
      error: null,
    });

    const result = await selectCatalogSongTitles("cat_1");

    expect(supabase.from).toHaveBeenCalledWith("catalog_songs");
    expect(builder.eq).toHaveBeenCalledWith("catalog", "cat_1");
    expect(result).toEqual([
      { isrc: "ISRC1", title: "Song One" },
      { isrc: "ISRC2", title: null },
    ]);
  });

  it("returns [] on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockBuilder({ data: null, error: { message: "boom" } });

    expect(await selectCatalogSongTitles("cat_1")).toEqual([]);
    consoleError.mockRestore();
  });
});
