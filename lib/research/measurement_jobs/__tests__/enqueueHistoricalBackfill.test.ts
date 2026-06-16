import { describe, it, expect, vi, beforeEach } from "vitest";
import { enqueueHistoricalBackfill } from "../enqueueHistoricalBackfill";
import { resolveScopeSongs } from "../resolveScopeSongs";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { upsertSongstatsBackfillQueue } from "@/lib/supabase/songstats_backfill_queue/upsertSongstatsBackfillQueue";

vi.mock("../resolveScopeSongs", () => ({ resolveScopeSongs: vi.fn() }));
vi.mock("@/lib/supabase/song_measurements/selectSongMeasurements", () => ({
  selectSongMeasurements: vi.fn(),
}));
vi.mock("@/lib/supabase/songstats_backfill_queue/upsertSongstatsBackfillQueue", () => ({
  upsertSongstatsBackfillQueue: vi.fn(),
}));

describe("enqueueHistoricalBackfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(upsertSongstatsBackfillQueue).mockResolvedValue(undefined);
  });

  it("400s when the scope resolves to no recordings", async () => {
    vi.mocked(resolveScopeSongs).mockResolvedValue([]);
    const r = await enqueueHistoricalBackfill({ isrcs: ["X"] });
    expect(r).toEqual({
      error: "No recordings resolvable from the given scope — no identifier mappings exist yet",
      status: 400,
    });
  });

  it("enqueues un-backfilled songs ranked by latest count, skips already-backfilled ones", async () => {
    vi.mocked(resolveScopeSongs).mockResolvedValue(["I1", "I2", "I3"]);
    // newest-first rows; I2 already has a songstats row (already backfilled)
    vi.mocked(selectSongMeasurements).mockResolvedValue([
      { song: "I1", value: 500, data_source: "apify_spotify_playcount" },
      { song: "I2", value: 300, data_source: "songstats" },
      { song: "I3", value: 100, data_source: "apify_spotify_playcount" },
    ] as never);

    const r = await enqueueHistoricalBackfill({ isrcs: ["I1", "I2", "I3"] });

    expect(upsertSongstatsBackfillQueue).toHaveBeenCalledTimes(2);
    expect(upsertSongstatsBackfillQueue).toHaveBeenCalledWith({ song: "I1", rank_score: 500 });
    expect(upsertSongstatsBackfillQueue).toHaveBeenCalledWith({ song: "I3", rank_score: 100 });
    expect(upsertSongstatsBackfillQueue).not.toHaveBeenCalledWith(
      expect.objectContaining({ song: "I2" }),
    );
    expect(r).toEqual({
      data: { status: "success", source: "historical", id: null, enqueued: 2, skipped: 1 },
    });
  });

  it("ranks a song with no prior measurement at 0", async () => {
    vi.mocked(resolveScopeSongs).mockResolvedValue(["I9"]);
    vi.mocked(selectSongMeasurements).mockResolvedValue([] as never);

    await enqueueHistoricalBackfill({ isrcs: ["I9"] });

    expect(upsertSongstatsBackfillQueue).toHaveBeenCalledWith({ song: "I9", rank_score: 0 });
  });
});
