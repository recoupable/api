import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchAudienceRequest } from "../validateGetResearchAudienceRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateGetResearchAudienceRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
  });

  it("defaults platform to instagram when omitted", async () => {
    const result = await validateGetResearchAudienceRequest(
      new NextRequest("http://x/?artist=Drake"),
    );
    expect(result).toEqual({
      accountId: "acc_1",
      artist: "Drake",
      platform: "instagram",
    });
  });

  it("defaults platform to instagram when blank", async () => {
    const result = await validateGetResearchAudienceRequest(
      new NextRequest("http://x/?artist=Drake&platform="),
    );
    expect(result).toEqual({
      accountId: "acc_1",
      artist: "Drake",
      platform: "instagram",
    });
  });

  it("returns 400 when platform is not in the allowed list", async () => {
    const result = await validateGetResearchAudienceRequest(
      new NextRequest("http://x/?artist=Drake&platform=myspace"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toContain("Invalid platform");
      expect(body.error).toContain("instagram");
      expect(body.error).toContain("spotify");
    }
  });

  it("returns 400 when platform contains path traversal characters", async () => {
    const result = await validateGetResearchAudienceRequest(
      new NextRequest("http://x/?artist=Drake&platform=../admin"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toContain("Invalid platform");
    }
  });

  it("delegates artist validation to validateArtistRequest (400 when artist missing)", async () => {
    const result = await validateGetResearchAudienceRequest(
      new NextRequest("http://x/?platform=spotify"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toBe("artist or id parameter is required");
    }
  });

  it("returns accountId, artist, and platform on success", async () => {
    const result = await validateGetResearchAudienceRequest(
      new NextRequest("http://x/?artist=Drake&platform=tiktok"),
    );
    expect(result).toEqual({
      accountId: "acc_1",
      artist: "Drake",
      platform: "tiktok",
    });
  });

  it("accepts youtube_channel as a platform", async () => {
    const result = await validateGetResearchAudienceRequest(
      new NextRequest("http://x/?artist=Drake&platform=youtube_channel"),
    );
    expect(result).toEqual({
      accountId: "acc_1",
      artist: "Drake",
      platform: "youtube_channel",
    });
  });
});
