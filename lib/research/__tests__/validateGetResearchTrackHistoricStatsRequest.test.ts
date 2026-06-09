import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetResearchTrackHistoricStatsRequest } from "../validateGetResearchTrackHistoricStatsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

describe("validateGetResearchTrackHistoricStatsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
  });

  it("returns the auth response (401) when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }) as never,
    );
    const r = await validateGetResearchTrackHistoricStatsRequest(
      new NextRequest("http://x/?isrc=USQY51771120&source=spotify"),
    );
    expect((r as NextResponse).status).toBe(401);
  });

  it("returns 400 when no track identifier is provided", async () => {
    const r = await validateGetResearchTrackHistoricStatsRequest(
      new NextRequest("http://x/?source=spotify"),
    );
    expect((r as NextResponse).status).toBe(400);
    expect((await (r as NextResponse).json()).error).toContain("identifier");
  });

  it("returns 400 when more than one identifier is provided (exactly one required)", async () => {
    const r = await validateGetResearchTrackHistoricStatsRequest(
      new NextRequest("http://x/?isrc=USQY51771120&spotify_track_id=abc&source=spotify"),
    );
    expect((r as NextResponse).status).toBe(400);
    expect((await (r as NextResponse).json()).error).toContain("exactly one");
  });

  it("returns 400 when source is missing", async () => {
    const r = await validateGetResearchTrackHistoricStatsRequest(
      new NextRequest("http://x/?isrc=USQY51771120"),
    );
    expect((r as NextResponse).status).toBe(400);
    expect((await (r as NextResponse).json()).error).toBe("source parameter is required");
  });

  it("forwards identifier + source + the historic passthroughs on success", async () => {
    const r = await validateGetResearchTrackHistoricStatsRequest(
      new NextRequest(
        "http://x/?isrc=USQY51771120&source=spotify&start_date=2024-06-09&end_date=2025-06-09&with_aggregates=true",
      ),
    );
    expect(r).toEqual({
      accountId: "acc_1",
      params: {
        isrc: "USQY51771120",
        source: "spotify",
        start_date: "2024-06-09",
        end_date: "2025-06-09",
        with_aggregates: "true",
      },
    });
  });
});
