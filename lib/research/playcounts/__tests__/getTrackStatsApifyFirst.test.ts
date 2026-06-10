import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTrackStatsApifyFirst } from "../getTrackStatsApifyFirst";

import { getResearchTrackStats } from "@/lib/research/getResearchTrackStats";
import { getSpotifyStatFromStore } from "@/lib/research/playcounts/getSpotifyStatFromStore";
import { deductCredits } from "@/lib/research/deductCredits";

vi.mock("@/lib/research/getResearchTrackStats", () => ({ getResearchTrackStats: vi.fn() }));
vi.mock("@/lib/research/playcounts/getSpotifyStatFromStore", () => ({
  getSpotifyStatFromStore: vi.fn(),
}));
vi.mock("@/lib/research/deductCredits", () => ({ deductCredits: vi.fn() }));

const STORE_STAT = {
  source: "spotify" as const,
  data: { streams_total: 1332534384 },
  data_source: "apify_spotify_playcount",
  captured_at: "2026-06-10T23:10:49Z",
};

describe("getTrackStatsApifyFirst", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serves spotify-only from the store: no Songstats, credits deducted", async () => {
    vi.mocked(getSpotifyStatFromStore).mockResolvedValue(STORE_STAT);

    const result = await getTrackStatsApifyFirst({
      accountId: "acc_1",
      params: { isrc: "USA2P2015959", source: "spotify" },
    });

    expect(getSpotifyStatFromStore).toHaveBeenCalledWith("USA2P2015959");
    expect(getResearchTrackStats).not.toHaveBeenCalled();
    expect(deductCredits).toHaveBeenCalledWith("acc_1");
    expect(result).toEqual({ data: { result: "success", stats: [STORE_STAT] } });
  });

  it("delegates remaining sources to the passthrough and appends the store stat, labeling provenance", async () => {
    vi.mocked(getSpotifyStatFromStore).mockResolvedValue(STORE_STAT);
    vi.mocked(getResearchTrackStats).mockResolvedValue({
      data: { result: "success", stats: [{ source: "deezer", data: { streams_total: 1000 } }] },
    });

    const result = await getTrackStatsApifyFirst({
      accountId: "acc_1",
      params: { isrc: "USA2P2015959", source: "spotify,deezer" },
    });

    expect(getResearchTrackStats).toHaveBeenCalledWith({
      accountId: "acc_1",
      params: { isrc: "USA2P2015959", source: "deezer" },
    });
    const data = (result as { data: { stats: unknown[] } }).data;
    expect(data.stats).toEqual([
      { source: "deezer", data: { streams_total: 1000 }, data_source: "songstats" },
      STORE_STAT,
    ]);
  });

  it("falls back to the full passthrough when the store can't answer, labeling provenance", async () => {
    vi.mocked(getSpotifyStatFromStore).mockResolvedValue(null);
    vi.mocked(getResearchTrackStats).mockResolvedValue({
      data: { result: "success", stats: [{ source: "spotify", data: { streams_total: 84 } }] },
    });

    const result = await getTrackStatsApifyFirst({
      accountId: "acc_1",
      params: { isrc: "USQY51771120", source: "spotify" },
    });

    expect(getResearchTrackStats).toHaveBeenCalledWith({
      accountId: "acc_1",
      params: { isrc: "USQY51771120", source: "spotify" },
    });
    const data = (result as { data: { stats: Array<{ data_source?: string }> } }).data;
    expect(data.stats[0].data_source).toBe("songstats");
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("does not consult the store for non-spotify sources or non-isrc identifiers", async () => {
    vi.mocked(getResearchTrackStats).mockResolvedValue({ data: { result: "success", stats: [] } });

    await getTrackStatsApifyFirst({
      accountId: "acc_1",
      params: { isrc: "USQY51771120", source: "deezer" },
    });
    await getTrackStatsApifyFirst({
      accountId: "acc_1",
      params: { spotify_track_id: "track_x", source: "spotify" },
    });

    expect(getSpotifyStatFromStore).not.toHaveBeenCalled();
    expect(getResearchTrackStats).toHaveBeenCalledTimes(2);
  });

  it("passes a non-conforming Songstats payload through unlabeled (shape drift)", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(getSpotifyStatFromStore).mockResolvedValue(null);
    vi.mocked(getResearchTrackStats).mockResolvedValue({ data: "raw-html-error-page" });

    const result = await getTrackStatsApifyFirst({
      accountId: "acc_1",
      params: { isrc: "USQY51771120", source: "spotify" },
    });

    expect(result).toEqual({ data: "raw-html-error-page" });
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it("passes through upstream error results untouched", async () => {
    vi.mocked(getSpotifyStatFromStore).mockResolvedValue(null);
    vi.mocked(getResearchTrackStats).mockResolvedValue({
      error: "Request failed with status 404",
      status: 404,
    });

    const result = await getTrackStatsApifyFirst({
      accountId: "acc_1",
      params: { isrc: "BADISRC", source: "spotify" },
    });

    expect(result).toEqual({ error: "Request failed with status 404", status: 404 });
  });
});
