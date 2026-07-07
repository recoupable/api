import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAllSongMeasurements } from "../selectAllSongMeasurements";
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
  for (const m of ["select", "eq", "in", "order", "range"])
    builder[m] = vi.fn().mockReturnValue(builder);
  builder.then = resolve => resolve(result);
  return builder;
}

/** Queue one builder per supabase.from() call (one per page per chunk). */
function mockPages(results: Result[]) {
  const builders = results.map(makeBuilder);
  let call = 0;
  vi.mocked(supabase.from).mockImplementation(() => builders[call++] as never);
  return builders;
}

const row = (song: string, value: number, capturedAt = "2026-07-01T00:00:00Z") => ({
  song,
  value,
  captured_at: capturedAt,
  platform: "spotify",
  metric: "platform_displayed_play_count",
});

const params = { platform: "spotify", metric: "platform_displayed_play_count" };

describe("selectAllSongMeasurements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] without querying when songs is empty", async () => {
    expect(await selectAllSongMeasurements({ songs: [], ...params })).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("reads a small batch in one query, newest-first with filters applied", async () => {
    const builders = mockPages([{ data: [row("ISRC1", 200), row("ISRC2", 50)], error: null }]);

    const result = await selectAllSongMeasurements({ songs: ["ISRC1", "ISRC2"], ...params });

    expect(supabase.from).toHaveBeenCalledWith("song_measurements");
    expect(builders[0].in).toHaveBeenCalledWith("song", ["ISRC1", "ISRC2"]);
    expect(builders[0].eq).toHaveBeenCalledWith("platform", "spotify");
    expect(builders[0].eq).toHaveBeenCalledWith("metric", "platform_displayed_play_count");
    expect(builders[0].order).toHaveBeenCalledWith("captured_at", { ascending: false });
    expect(builders[0].range).toHaveBeenCalledWith(0, 999);
    expect(result).toEqual([row("ISRC1", 200), row("ISRC2", 50)]);
  });

  it("paginates each read past the 1,000-row page size to exhaustion", async () => {
    const pageOne = Array.from({ length: 1000 }, (_, i) => row(`ISRC${i}`, i));
    const pageTwo = Array.from({ length: 300 }, (_, i) => row(`ISRC${1000 + i}`, i));
    const builders = mockPages([
      { data: pageOne, error: null },
      { data: pageTwo, error: null },
    ]);

    const songs = Array.from({ length: 400 }, (_, i) => `ISRC${i}`);
    const result = await selectAllSongMeasurements({ songs, ...params });

    expect(result).toHaveLength(1300);
    expect(builders[0].range).toHaveBeenCalledWith(0, 999);
    expect(builders[1].range).toHaveBeenCalledWith(1000, 1999);
  });

  it("chunks large ISRC lists so the IN clause stays bounded", async () => {
    const songs = Array.from({ length: 1200 }, (_, i) => `ISRC${i}`);
    const builders = mockPages([
      { data: [row("ISRC0", 1)], error: null },
      { data: [row("ISRC500", 2)], error: null },
      { data: [row("ISRC1000", 3)], error: null },
    ]);

    const result = await selectAllSongMeasurements({ songs, ...params });

    expect(supabase.from).toHaveBeenCalledTimes(3);
    expect(builders[0].in).toHaveBeenCalledWith("song", songs.slice(0, 500));
    expect(builders[1].in).toHaveBeenCalledWith("song", songs.slice(500, 1000));
    expect(builders[2].in).toHaveBeenCalledWith("song", songs.slice(1000));
    expect(result).toEqual([row("ISRC0", 1), row("ISRC500", 2), row("ISRC1000", 3)]);
  });

  it("returns [] on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPages([{ data: null, error: { message: "boom" } }]);

    expect(await selectAllSongMeasurements({ songs: ["ISRC1"], ...params })).toEqual([]);
    consoleError.mockRestore();
  });
});
