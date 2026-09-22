import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetResearchTrackStatsRequest } from "../validateGetResearchTrackStatsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

describe("validateGetResearchTrackStatsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
  });

  it("returns the auth response (401) when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }) as never,
    );
    const result = await validateGetResearchTrackStatsRequest(
      new NextRequest("http://x/?isrc=USQY51771120"),
    );
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 400 when isrc is missing", async () => {
    const result = await validateGetResearchTrackStatsRequest(
      new NextRequest("http://x/?source=spotify"),
    );
    expect((result as NextResponse).status).toBe(400);
    expect((await (result as NextResponse).json()).error).toBe("isrc parameter is required");
  });

  it("returns 400 when source is anything but spotify", async () => {
    const result = await validateGetResearchTrackStatsRequest(
      new NextRequest("http://x/?isrc=USQY51771120&source=deezer"),
    );
    expect((result as NextResponse).status).toBe(400);
    expect((await (result as NextResponse).json()).error).toBe("source must be spotify");
  });

  it("returns accountId + isrc, defaulting source to spotify", async () => {
    const result = await validateGetResearchTrackStatsRequest(
      new NextRequest("http://x/?isrc=USQY51771120"),
    );
    expect(result).toEqual({ accountId: "acc_1", isrc: "USQY51771120" });
  });

  it("accepts an explicit source=spotify", async () => {
    const result = await validateGetResearchTrackStatsRequest(
      new NextRequest("http://x/?isrc=USQY51771120&source=spotify"),
    );
    expect(result).toEqual({ accountId: "acc_1", isrc: "USQY51771120" });
  });
});
