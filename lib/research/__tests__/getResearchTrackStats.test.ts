import { describe, it, expect, vi, beforeEach } from "vitest";
import { getResearchTrackStats } from "../getResearchTrackStats";
import { fetchSongstats } from "@/lib/songstats/fetchSongstats";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { getSpotifyStatFromStore } from "@/lib/research/playcounts/getSpotifyStatFromStore";

vi.mock("@/lib/songstats/fetchSongstats", () => ({ fetchSongstats: vi.fn() }));
vi.mock("@/lib/credits/recordCreditDeduction", () => ({ recordCreditDeduction: vi.fn() }));
vi.mock("@/lib/research/playcounts/getSpotifyStatFromStore", () => ({
  getSpotifyStatFromStore: vi.fn(),
}));

const STORE_STAT = {
  source: "spotify" as const,
  data: { streams_total: 1331384578 },
  data_source: "apify_spotify_playcount",
  captured_at: "2026-06-10T06:00:00Z",
};

describe("getResearchTrackStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serves spotify from the measurement store without calling Songstats (spotify-only)", async () => {
    vi.mocked(getSpotifyStatFromStore).mockResolvedValue(STORE_STAT);

    const result = await getResearchTrackStats({
      accountId: "acc_1",
      params: { isrc: "USUYG1069896", source: "spotify" },
    });

    expect(getSpotifyStatFromStore).toHaveBeenCalledWith("USUYG1069896");
    expect(fetchSongstats).not.toHaveBeenCalled();
    expect(result).toEqual({ data: { result: "success", stats: [STORE_STAT] } });
    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 5,
      source: "api",
    });
  });

  it("merges store spotify with Songstats for the remaining sources", async () => {
    vi.mocked(getSpotifyStatFromStore).mockResolvedValue(STORE_STAT);
    const songstatsPayload = {
      result: "success",
      stats: [{ source: "deezer", data: { streams_total: 1000 } }],
    };
    vi.mocked(fetchSongstats).mockResolvedValue({ data: songstatsPayload, status: 200 });

    const result = await getResearchTrackStats({
      accountId: "acc_1",
      params: { isrc: "USUYG1069896", source: "spotify,deezer" },
    });

    expect(fetchSongstats).toHaveBeenCalledWith("tracks/stats", {
      isrc: "USUYG1069896",
      source: "deezer",
    });
    const data = (result as { data: { stats: Array<{ source: string }> } }).data;
    expect(data.stats).toEqual([
      { source: "deezer", data: { streams_total: 1000 }, data_source: "songstats" },
      STORE_STAT,
    ]);
  });

  it("falls back to full Songstats passthrough when the store can't answer, labeling provenance", async () => {
    vi.mocked(getSpotifyStatFromStore).mockResolvedValue(null);
    const payload = {
      result: "success",
      stats: [{ source: "spotify", data: { streams_total: 84213771 } }],
    };
    vi.mocked(fetchSongstats).mockResolvedValue({ data: payload, status: 200 });

    const result = await getResearchTrackStats({
      accountId: "acc_1",
      params: { isrc: "USQY51771120", source: "spotify" },
    });

    expect(fetchSongstats).toHaveBeenCalledWith("tracks/stats", {
      isrc: "USQY51771120",
      source: "spotify",
    });
    const data = (result as { data: { stats: Array<{ data_source?: string }> } }).data;
    expect(data.stats[0].data_source).toBe("songstats");
    expect(recordCreditDeduction).toHaveBeenCalled();
  });

  it("does not consult the store for non-spotify sources or non-isrc identifiers", async () => {
    const payload = { result: "success", stats: [{ source: "deezer", data: {} }] };
    vi.mocked(fetchSongstats).mockResolvedValue({ data: payload, status: 200 });

    await getResearchTrackStats({
      accountId: "acc_1",
      params: { isrc: "USQY51771120", source: "deezer" },
    });
    await getResearchTrackStats({
      accountId: "acc_1",
      params: { spotify_track_id: "track_x", source: "spotify" },
    });

    expect(getSpotifyStatFromStore).not.toHaveBeenCalled();
    expect(fetchSongstats).toHaveBeenCalledTimes(2);
  });

  it("returns an error result on a non-200 upstream status (no deduction)", async () => {
    vi.mocked(getSpotifyStatFromStore).mockResolvedValue(null);
    vi.mocked(fetchSongstats).mockResolvedValue({ data: { error: "not found" }, status: 404 });

    const result = await getResearchTrackStats({
      accountId: "acc_1",
      params: { isrc: "BADISRC", source: "spotify" },
    });

    expect(result).toEqual({ error: "Request failed with status 404", status: 404 });
    expect(recordCreditDeduction).not.toHaveBeenCalled();
  });
});
