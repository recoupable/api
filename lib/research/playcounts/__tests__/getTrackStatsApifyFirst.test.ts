import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTrackStatsApifyFirst } from "../getTrackStatsApifyFirst";
import { getSpotifyStatFromStore } from "@/lib/research/playcounts/getSpotifyStatFromStore";
import { deductCredits } from "@/lib/research/deductCredits";

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

  it("serves the store stat and deducts credits", async () => {
    vi.mocked(getSpotifyStatFromStore).mockResolvedValue(STORE_STAT);

    const result = await getTrackStatsApifyFirst({
      accountId: "acc_1",
      isrc: "USA2P2015959",
      modelId: "GET /api/research/track/stats",
    });

    expect(getSpotifyStatFromStore).toHaveBeenCalledWith("USA2P2015959");
    expect(deductCredits).toHaveBeenCalledWith("acc_1", "GET /api/research/track/stats");
    expect(result).toEqual({ data: { result: "success", stats: [STORE_STAT] } });
  });

  it("returns 404 without charging when the store cannot answer", async () => {
    vi.mocked(getSpotifyStatFromStore).mockResolvedValue(null);

    const result = await getTrackStatsApifyFirst({ accountId: "acc_1", isrc: "USQY51771120" });

    expect(deductCredits).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "No stored capture for this ISRC — create a current measurement job first",
      status: 404,
    });
  });
});
