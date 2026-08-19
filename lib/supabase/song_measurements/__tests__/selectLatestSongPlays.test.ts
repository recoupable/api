import { describe, it, expect, vi, beforeEach } from "vitest";

const { selectSongMeasurementsMock } = vi.hoisted(() => ({
  selectSongMeasurementsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/song_measurements/selectSongMeasurements", () => ({
  selectSongMeasurements: selectSongMeasurementsMock,
}));

const { selectLatestSongPlays } = await import(
  "@/lib/supabase/song_measurements/selectLatestSongPlays"
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("selectLatestSongPlays", () => {
  it("returns the latest spotify play count per song (rows come newest-first)", async () => {
    selectSongMeasurementsMock.mockResolvedValue([
      { song: "ISRC1", value: 128441, captured_at: "2026-08-17" },
      { song: "ISRC2", value: 96102, captured_at: "2026-08-17" },
      { song: "ISRC1", value: 90000, captured_at: "2026-07-01" },
    ]);

    const plays = await selectLatestSongPlays(["ISRC1", "ISRC2"]);

    expect(plays).toEqual({ ISRC1: 128441, ISRC2: 96102 });
    expect(selectSongMeasurementsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        songs: ["ISRC1", "ISRC2"],
        platform: "spotify",
        metric: "platform_displayed_play_count",
      }),
    );
  });

  it("chunks large ISRC lists", async () => {
    selectSongMeasurementsMock.mockResolvedValue([]);
    const isrcs = Array.from({ length: 401 }, (_, i) => `I${i}`);

    await selectLatestSongPlays(isrcs);

    expect(selectSongMeasurementsMock).toHaveBeenCalledTimes(3);
  });

  it("returns {} for no ISRCs without querying, and treats a query error as no data", async () => {
    expect(await selectLatestSongPlays([])).toEqual({});
    expect(selectSongMeasurementsMock).not.toHaveBeenCalled();

    selectSongMeasurementsMock.mockRejectedValue(new Error("boom"));
    expect(await selectLatestSongPlays(["ISRC1"])).toEqual({});
  });
});
