import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTrackMeasurements } from "../getTrackMeasurements";
import { resolveTrackIsrc } from "../resolveTrackIsrc";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { computePlaycountDeltas } from "@/lib/research/playcounts/computePlaycountDeltas";
import { deductCredits } from "@/lib/research/deductCredits";

vi.mock("../resolveTrackIsrc", () => ({ resolveTrackIsrc: vi.fn() }));
vi.mock("@/lib/supabase/song_measurements/selectSongMeasurements", () => ({
  selectSongMeasurements: vi.fn(),
}));
vi.mock("@/lib/research/playcounts/computePlaycountDeltas", () => ({
  computePlaycountDeltas: vi.fn(),
}));
vi.mock("@/lib/research/deductCredits", () => ({ deductCredits: vi.fn() }));

const base = {
  accountId: "acc_1",
  id: "USQY51771120",
  platform: "spotify",
  metric: "platform_displayed_play_count",
  windowDays: 365,
};

// newest-first store rows for one song
const rows = [
  {
    song: "I",
    platform: "spotify",
    metric: "m",
    value: 300,
    captured_at: "2026-06-12T00:00:00+00:00",
    data_source: "apify_spotify_playcount",
  },
  {
    song: "I",
    platform: "spotify",
    metric: "m",
    value: 100,
    captured_at: "2025-06-12T00:00:00+00:00",
    data_source: "songstats",
  },
];

describe("getTrackMeasurements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveTrackIsrc).mockResolvedValue("I");
    vi.mocked(selectSongMeasurements).mockResolvedValue(rows as never);
  });

  it("404s when the id resolves to no ISRC", async () => {
    vi.mocked(resolveTrackIsrc).mockResolvedValue(null);
    const r = await getTrackMeasurements({ ...base });
    expect(r).toEqual({ error: "Unknown track id", status: 404 });
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("404s when the track has no measurements yet", async () => {
    vi.mocked(selectSongMeasurements).mockResolvedValue([] as never);
    const r = await getTrackMeasurements({ ...base });
    expect((r as { status: number }).status).toBe(404);
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("returns the ascending daily series by default and charges one credit", async () => {
    const r = await getTrackMeasurements({ ...base });
    expect(computePlaycountDeltas).not.toHaveBeenCalled();
    expect(deductCredits).toHaveBeenCalledWith("acc_1");
    expect(r).toEqual({
      data: {
        status: "success",
        id: "USQY51771120",
        platform: "spotify",
        metric: "platform_displayed_play_count",
        series: [
          { date: "2025-06-12", value: 100, data_source: "songstats" },
          { date: "2026-06-12", value: 300, data_source: "apify_spotify_playcount" },
        ],
      },
    });
  });

  it("returns a run_rate aggregate over the trailing window when aggregate=run_rate", async () => {
    vi.mocked(computePlaycountDeltas).mockReturnValue([
      {
        platform: "spotify",
        metric: "platform_displayed_play_count",
        since: { captured_at: "2025-06-12T00:00:00+00:00", value: 100 },
        until: { captured_at: "2026-06-12T00:00:00+00:00", value: 300 },
        delta: 200,
        days: 365,
        run_rate_annualized: 200,
      },
    ]);

    const r = await getTrackMeasurements({ ...base, aggregate: "run_rate" });

    // window start = latest date (2026-06-12) minus 365d
    expect(computePlaycountDeltas).toHaveBeenCalledWith(rows, { since: "2025-06-12" });
    expect(r).toEqual({
      data: {
        status: "success",
        id: "USQY51771120",
        platform: "spotify",
        metric: "platform_displayed_play_count",
        aggregate: { kind: "run_rate", window_days: 365, delta: 200, run_rate_annualized: 200 },
      },
    });
  });

  it("returns a null aggregate when history is insufficient for a run-rate", async () => {
    vi.mocked(computePlaycountDeltas).mockReturnValue([]);
    const r = await getTrackMeasurements({ ...base, aggregate: "run_rate" });
    expect((r as { data: { aggregate: unknown } }).data.aggregate).toBeNull();
  });
});
