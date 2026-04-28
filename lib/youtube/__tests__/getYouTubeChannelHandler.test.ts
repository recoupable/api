import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getYouTubeChannelHandler } from "@/lib/youtube/getYouTubeChannelHandler";
import { validateYouTubeTokens } from "@/lib/youtube/validateYouTubeTokens";
import { fetchYouTubeChannelInfo } from "@/lib/youtube/fetchYouTubeChannelInfo";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/youtube/validateYouTubeTokens", () => ({
  validateYouTubeTokens: vi.fn(),
}));

vi.mock("@/lib/youtube/fetchYouTubeChannelInfo", () => ({
  fetchYouTubeChannelInfo: vi.fn(),
}));

const ARTIST_ID = "11111111-1111-1111-1111-111111111111";

const buildRequest = (search: string) =>
  new NextRequest(`https://example.com/api/youtube/channel-info${search}`);

const validTokens = {
  id: "row-1",
  artist_account_id: ARTIST_ID,
  access_token: "access-abc",
  refresh_token: "refresh-abc",
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("getYouTubeChannelHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 with tokenStatus=missing_param when artist_account_id is missing", async () => {
    const response = await getYouTubeChannelHandler(buildRequest(""));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      error: "Missing artist_account_id parameter",
      tokenStatus: "missing_param",
    });
    expect(validateYouTubeTokens).not.toHaveBeenCalled();
  });

  it("returns 200 with tokenStatus=invalid when token validation fails", async () => {
    vi.mocked(validateYouTubeTokens).mockResolvedValue({
      success: false,
      error: { code: "NO_TOKENS", message: "no tokens" },
    });

    const response = await getYouTubeChannelHandler(
      buildRequest(`?artist_account_id=${ARTIST_ID}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: false,
      error: "YouTube authentication required",
      tokenStatus: "invalid",
      channels: null,
    });
  });

  it("returns 200 with tokenStatus=api_error when YouTube API returns an error", async () => {
    vi.mocked(validateYouTubeTokens).mockResolvedValue({ success: true, tokens: validTokens });
    vi.mocked(fetchYouTubeChannelInfo).mockResolvedValue({
      success: false,
      error: { code: "API_ERROR", message: "boom" },
    });

    const response = await getYouTubeChannelHandler(
      buildRequest(`?artist_account_id=${ARTIST_ID}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: false,
      error: "boom",
      tokenStatus: "api_error",
      channels: null,
    });
  });

  it("returns 200 with tokenStatus=valid and channels on success", async () => {
    vi.mocked(validateYouTubeTokens).mockResolvedValue({ success: true, tokens: validTokens });

    const channelData: any = [{ id: "ch1", title: "Channel" }];
    vi.mocked(fetchYouTubeChannelInfo).mockResolvedValue({ success: true, channelData });

    const response = await getYouTubeChannelHandler(
      buildRequest(`?artist_account_id=${ARTIST_ID}`),
    );
    const body = await response.json();

    expect(fetchYouTubeChannelInfo).toHaveBeenCalledWith({
      accessToken: "access-abc",
      refreshToken: "refresh-abc",
      includeBranding: true,
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, channels: channelData, tokenStatus: "valid" });
  });

  it("returns 200 with tokenStatus=error and no raw error leak when an unexpected exception bubbles up", async () => {
    vi.mocked(validateYouTubeTokens).mockRejectedValue(new Error("db dead"));

    const response = await getYouTubeChannelHandler(
      buildRequest(`?artist_account_id=${ARTIST_ID}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: false,
      error: "Failed to fetch YouTube channel information",
      tokenStatus: "error",
      channels: null,
    });
    expect(JSON.stringify(body)).not.toContain("db dead");
  });
});
