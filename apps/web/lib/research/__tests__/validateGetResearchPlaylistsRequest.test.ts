import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchPlaylistsRequest } from "../validateGetResearchPlaylistsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateGetResearchPlaylistsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
  });

  it("returns 400 when platform is not allowed", async () => {
    const result = await validateGetResearchPlaylistsRequest(
      new NextRequest("http://x/?artist=Drake&platform=myspace"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toContain("Invalid platform");
    }
  });

  it("defaults platform to 'spotify' and status to 'current' when omitted", async () => {
    const result = await validateGetResearchPlaylistsRequest(
      new NextRequest("http://x/?artist=Drake"),
    );
    expect(result).toEqual({
      accountId: "acc_1",
      artist: "Drake",
      platform: "spotify",
      status: "current",
    });
  });

  it("accepts explicit platform and status values", async () => {
    const result = await validateGetResearchPlaylistsRequest(
      new NextRequest("http://x/?artist=Drake&platform=applemusic&status=past"),
    );
    expect(result).toEqual({
      accountId: "acc_1",
      artist: "Drake",
      platform: "applemusic",
      status: "past",
    });
  });
});
