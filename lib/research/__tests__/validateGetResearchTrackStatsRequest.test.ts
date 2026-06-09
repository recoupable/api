import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetResearchTrackStatsRequest } from "../validateGetResearchTrackStatsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

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
      new NextRequest("http://x/?isrc=USQY51771120&source=spotify"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 400 when no track identifier is provided", async () => {
    const result = await validateGetResearchTrackStatsRequest(
      new NextRequest("http://x/?source=spotify"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const body = await (result as NextResponse).json();
    expect(body.error).toContain("identifier");
  });

  it("returns 400 when source is missing", async () => {
    const result = await validateGetResearchTrackStatsRequest(
      new NextRequest("http://x/?isrc=USQY51771120"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const body = await (result as NextResponse).json();
    expect(body.error).toBe("source parameter is required");
  });

  it("returns accountId + forwarded params on success (isrc + passthroughs)", async () => {
    const result = await validateGetResearchTrackStatsRequest(
      new NextRequest("http://x/?isrc=USQY51771120&source=spotify&with_playlists=true&limit=5"),
    );
    expect(result).toEqual({
      accountId: "acc_1",
      params: { isrc: "USQY51771120", source: "spotify", with_playlists: "true", limit: "5" },
    });
  });

  it("accepts songstats_track_id as the identifier", async () => {
    const result = await validateGetResearchTrackStatsRequest(
      new NextRequest("http://x/?songstats_track_id=abc123&source=all"),
    );
    expect(result).toEqual({
      accountId: "acc_1",
      params: { songstats_track_id: "abc123", source: "all" },
    });
  });
});
