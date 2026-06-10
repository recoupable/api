import { describe, it, expect, vi, beforeEach } from "vitest";
import { getResearchTrackStats } from "../getResearchTrackStats";
import { fetchSongstats } from "@/lib/songstats/fetchSongstats";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("@/lib/songstats/fetchSongstats", () => ({ fetchSongstats: vi.fn() }));
vi.mock("@/lib/credits/recordCreditDeduction", () => ({ recordCreditDeduction: vi.fn() }));

describe("getResearchTrackStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes through to Songstats tracks/stats and returns data on 200, deducting credits", async () => {
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
    expect(result).toEqual({ data: payload });
    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 5,
      source: "api",
    });
  });

  it("returns an error result on a non-200 upstream status (no deduction)", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({ data: { error: "not found" }, status: 404 });

    const result = await getResearchTrackStats({
      accountId: "acc_1",
      params: { isrc: "BADISRC", source: "spotify" },
    });

    expect(result).toEqual({ error: "Request failed with status 404", status: 404 });
    expect(recordCreditDeduction).not.toHaveBeenCalled();
  });
});
