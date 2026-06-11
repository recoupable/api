import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getResearchTrackHistoricStatsHandler } from "../getResearchTrackHistoricStatsHandler";
import { validateGetResearchTrackHistoricStatsRequest } from "../validateGetResearchTrackHistoricStatsRequest";
import { getTrackHistoricStatsApifyFirst } from "../playcounts/getTrackHistoricStatsApifyFirst";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("../validateGetResearchTrackHistoricStatsRequest", () => ({
  validateGetResearchTrackHistoricStatsRequest: vi.fn(),
}));
vi.mock("../playcounts/getTrackHistoricStatsApifyFirst", () => ({
  getTrackHistoricStatsApifyFirst: vi.fn(),
}));

const req = () =>
  new NextRequest("http://x/api/research/track/historic-stats?isrc=USQY51771120&source=spotify");

describe("getResearchTrackHistoricStatsHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits with the validation response", async () => {
    vi.mocked(validateGetResearchTrackHistoricStatsRequest).mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "source parameter is required" },
        { status: 400 },
      ),
    );
    const res = await getResearchTrackHistoricStatsHandler(req());
    expect(res.status).toBe(400);
    expect(getTrackHistoricStatsApifyFirst).not.toHaveBeenCalled();
  });

  it("returns 200 with the historic stats envelope on success", async () => {
    vi.mocked(validateGetResearchTrackHistoricStatsRequest).mockResolvedValue({
      accountId: "acc_1",
      params: { isrc: "USQY51771120", source: "spotify" },
    });
    vi.mocked(getTrackHistoricStatsApifyFirst).mockResolvedValue({
      data: {
        result: "success",
        stats: [
          {
            source: "spotify",
            data: { history: [{ date: "2024-06-09", streams_total: 574845367 }] },
          },
        ],
        track_info: { title: "Nikes on My Feet" },
      },
    });
    const res = await getResearchTrackHistoricStatsHandler(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.stats[0].data.history[0].streams_total).toBe(574845367);
  });

  it("maps an upstream error result to an error response", async () => {
    vi.mocked(validateGetResearchTrackHistoricStatsRequest).mockResolvedValue({
      accountId: "acc_1",
      params: { isrc: "BADISRC", source: "spotify" },
    });
    vi.mocked(getTrackHistoricStatsApifyFirst).mockResolvedValue({
      error: "Request failed with status 404",
      status: 404,
    });
    const res = await getResearchTrackHistoricStatsHandler(req());
    expect(res.status).toBe(404);
  });
});
