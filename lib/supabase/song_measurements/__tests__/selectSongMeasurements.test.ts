import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectSongMeasurements } from "../selectSongMeasurements";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

function mockBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (resolve: (v: unknown) => void) => void;
  } = {} as never;
  for (const method of ["select", "eq", "in", "order", "limit"]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.then = resolve => resolve(result);
  vi.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}

const ROW = {
  song: "USA2P2015959",
  platform: "spotify",
  metric: "platform_displayed_play_count",
  value: 1332534384,
  captured_at: "2026-06-10T23:10:49Z",
  data_source: "apify_spotify_playcount",
};

describe("selectSongMeasurements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters by song, platform, metric, ordered newest-first with limit", async () => {
    const builder = mockBuilder({ data: [ROW], error: null });

    const result = await selectSongMeasurements({
      song: "USA2P2015959",
      platform: "spotify",
      metric: "platform_displayed_play_count",
      limit: 1,
    });

    expect(supabase.from).toHaveBeenCalledWith("song_measurements");
    expect(builder.eq).toHaveBeenCalledWith("song", "USA2P2015959");
    expect(builder.eq).toHaveBeenCalledWith("platform", "spotify");
    expect(builder.eq).toHaveBeenCalledWith("metric", "platform_displayed_play_count");
    expect(builder.order).toHaveBeenCalledWith("captured_at", { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(1);
    expect(result).toEqual([ROW]);
  });

  it("omits limit for full-series reads", async () => {
    const builder = mockBuilder({ data: [ROW, ROW], error: null });

    const result = await selectSongMeasurements({
      song: "USA2P2015959",
      platform: "spotify",
      metric: "platform_displayed_play_count",
    });

    expect(builder.limit).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("returns [] on query error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockBuilder({ data: null, error: { message: "boom" } });

    const result = await selectSongMeasurements({
      song: "X",
      platform: "spotify",
      metric: "m",
    });

    expect(result).toEqual([]);
    consoleError.mockRestore();
  });
});
