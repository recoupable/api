import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getResearchTrackStatsHandler } from "../getResearchTrackStatsHandler";
import { validateGetResearchTrackStatsRequest } from "../validateGetResearchTrackStatsRequest";
import { getResearchTrackStats } from "../getResearchTrackStats";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("../validateGetResearchTrackStatsRequest", () => ({
  validateGetResearchTrackStatsRequest: vi.fn(),
}));
vi.mock("../getResearchTrackStats", () => ({ getResearchTrackStats: vi.fn() }));

const req = () =>
  new NextRequest("http://x/api/research/track/stats?isrc=USQY51771120&source=spotify");

describe("getResearchTrackStatsHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits with the validation response", async () => {
    vi.mocked(validateGetResearchTrackStatsRequest).mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "source parameter is required" },
        { status: 400 },
      ),
    );
    const res = await getResearchTrackStatsHandler(req());
    expect(res.status).toBe(400);
    expect(getResearchTrackStats).not.toHaveBeenCalled();
  });

  it("returns 200 with the Songstats stats envelope on success", async () => {
    vi.mocked(validateGetResearchTrackStatsRequest).mockResolvedValue({
      accountId: "acc_1",
      params: { isrc: "USQY51771120", source: "spotify" },
    });
    vi.mocked(getResearchTrackStats).mockResolvedValue({
      data: {
        result: "success",
        message: "Data Retrieved.",
        stats: [{ source: "spotify", data: { streams_total: 84213771 } }],
        track_info: { title: "Nikes on My Feet" },
      },
    });
    const res = await getResearchTrackStatsHandler(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.stats[0].data.streams_total).toBe(84213771);
    expect(body.track_info.title).toBe("Nikes on My Feet");
  });

  it("maps an upstream error result to an error response", async () => {
    vi.mocked(validateGetResearchTrackStatsRequest).mockResolvedValue({
      accountId: "acc_1",
      params: { isrc: "BADISRC", source: "spotify" },
    });
    vi.mocked(getResearchTrackStats).mockResolvedValue({
      error: "Request failed with status 404",
      status: 404,
    });
    const res = await getResearchTrackStatsHandler(req());
    expect(res.status).toBe(404);
  });
});
