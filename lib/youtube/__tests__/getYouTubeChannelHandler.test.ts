import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getYouTubeChannelHandler } from "@/lib/youtube/getYouTubeChannelHandler";
import { validateYouTubeChannelInfoRequest } from "@/lib/youtube/validateYouTubeChannelInfoRequest";
import { fetchYouTubeChannelInfo } from "@/lib/youtube/fetchYouTubeChannelInfo";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/youtube/validateYouTubeChannelInfoRequest", () => ({
  validateYouTubeChannelInfoRequest: vi.fn(),
}));
vi.mock("@/lib/youtube/fetchYouTubeChannelInfo", () => ({
  fetchYouTubeChannelInfo: vi.fn(),
}));

const ARTIST_ID = "11111111-1111-1111-1111-111111111111";
const request = new NextRequest(
  `https://example.com/api/youtube/channel-info?artist_account_id=${ARTIST_ID}`,
);
const validated = {
  artist_account_id: ARTIST_ID,
  tokens: {
    id: "row-1",
    artist_account_id: ARTIST_ID,
    access_token: "access-abc",
    refresh_token: "refresh-abc",
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

describe("getYouTubeChannelHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes through the validator's NextResponse on validation failure", async () => {
    const validatorResponse = NextResponse.json({ success: false }, { status: 400 });
    vi.mocked(validateYouTubeChannelInfoRequest).mockResolvedValue(validatorResponse);

    const response = await getYouTubeChannelHandler(request);

    expect(response).toBe(validatorResponse);
    expect(fetchYouTubeChannelInfo).not.toHaveBeenCalled();
  });

  it("returns 200 with tokenStatus=valid and channels on success", async () => {
    vi.mocked(validateYouTubeChannelInfoRequest).mockResolvedValue(validated);
    const channelData: any = [{ id: "ch1", title: "Channel" }];
    vi.mocked(fetchYouTubeChannelInfo).mockResolvedValue({ success: true, channelData });

    const response = await getYouTubeChannelHandler(request);
    const body = await response.json();

    expect(fetchYouTubeChannelInfo).toHaveBeenCalledWith({
      accessToken: "access-abc",
      refreshToken: "refresh-abc",
      includeBranding: true,
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, channels: channelData, tokenStatus: "valid" });
  });

  it("returns 200 with tokenStatus=api_error when fetchYouTubeChannelInfo returns success:false", async () => {
    vi.mocked(validateYouTubeChannelInfoRequest).mockResolvedValue(validated);
    vi.mocked(fetchYouTubeChannelInfo).mockResolvedValue({
      success: false,
      error: { code: "API_ERROR", message: "boom" },
    });

    const response = await getYouTubeChannelHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: false,
      error: "boom",
      tokenStatus: "api_error",
      channels: null,
    });
  });

  it("returns 200 with tokenStatus=error and no raw error leak when fetchYouTubeChannelInfo throws", async () => {
    vi.mocked(validateYouTubeChannelInfoRequest).mockResolvedValue(validated);
    vi.mocked(fetchYouTubeChannelInfo).mockRejectedValue(new Error("upstream dead"));

    const response = await getYouTubeChannelHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: false,
      error: "Failed to fetch YouTube channel information",
      tokenStatus: "error",
      channels: null,
    });
    expect(JSON.stringify(body)).not.toContain("upstream dead");
  });
});
