import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectSongArtistIsrcs } from "../selectSongArtistIsrcs";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return { default: { from: mockFrom } };
});

type Result = { data: unknown; error: unknown };

function makeBuilder(result: Result) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (resolve: (v: unknown) => void) => void;
  } = {} as never;
  for (const m of ["select", "eq", "order", "range"]) builder[m] = vi.fn().mockReturnValue(builder);
  builder.then = resolve => resolve(result);
  return builder;
}

/** Queue one builder per supabase.from() call (one per page). */
function mockPages(results: Result[]) {
  const builders = results.map(makeBuilder);
  let call = 0;
  vi.mocked(supabase.from).mockImplementation(() => builders[call++] as never);
  return builders;
}

const artistAccountId = "b1814076-8e19-4a77-9dea-2ec150e26aaa";

describe("selectSongArtistIsrcs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the ISRCs linked to the artist account", async () => {
    const builders = mockPages([{ data: [{ song: "ISRC1" }, { song: "ISRC2" }], error: null }]);

    const result = await selectSongArtistIsrcs(artistAccountId);

    expect(supabase.from).toHaveBeenCalledWith("song_artists");
    expect(builders[0].eq).toHaveBeenCalledWith("artist", artistAccountId);
    expect(result).toEqual(["ISRC1", "ISRC2"]);
  });

  it("paginates past the 1,000-row page size to exhaustion", async () => {
    const pageOne = Array.from({ length: 1000 }, (_, i) => ({ song: `ISRC${i}` }));
    const pageTwo = Array.from({ length: 200 }, (_, i) => ({ song: `ISRC${1000 + i}` }));
    const builders = mockPages([
      { data: pageOne, error: null },
      { data: pageTwo, error: null },
    ]);

    const result = await selectSongArtistIsrcs(artistAccountId);

    expect(result).toHaveLength(1200);
    expect(builders[0].range).toHaveBeenCalledWith(0, 999);
    expect(builders[1].range).toHaveBeenCalledWith(1000, 1999);
    // deterministic pagination requires a stable order
    expect(builders[0].order).toHaveBeenCalledWith("song", { ascending: true });
  });

  it("returns [] on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPages([{ data: null, error: { message: "boom" } }]);

    expect(await selectSongArtistIsrcs(artistAccountId)).toEqual([]);
    consoleError.mockRestore();
  });
});
