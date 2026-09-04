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
      new NextRequest("http://x/?isrc=USQY51771120"),
    );
    expect((r as NextResponse).status).toBe(401);
  });

  it("returns 400 when isrc is missing", async () => {
    const r = await validateGetResearchTrackHistoricStatsRequest(
      new NextRequest("http://x/?source=spotify"),
    );
    expect((r as NextResponse).status).toBe(400);
    expect((await (r as NextResponse).json()).error).toBe("isrc parameter is required");
  });

  it("returns 400 when source is anything but spotify", async () => {
    const r = await validateGetResearchTrackHistoricStatsRequest(
      new NextRequest("http://x/?isrc=USQY51771120&source=deezer"),
    );
    expect((r as NextResponse).status).toBe(400);
    expect((await (r as NextResponse).json()).error).toBe("source must be spotify");
  });

  it("returns accountId + isrc + the optional date window", async () => {
    const r = await validateGetResearchTrackHistoricStatsRequest(
      new NextRequest("http://x/?isrc=USQY51771120&start_date=2024-06-09&end_date=2025-06-09"),
    );
    expect(r).toEqual({
      accountId: "acc_1",
      isrc: "USQY51771120",
      startDate: "2024-06-09",
      endDate: "2025-06-09",
    });
  });

  it("omits the window keys when no dates are given", async () => {
    const r = await validateGetResearchTrackHistoricStatsRequest(
      new NextRequest("http://x/?isrc=USQY51771120"),
    );
    expect(r).toEqual({ accountId: "acc_1", isrc: "USQY51771120" });
  });
});
