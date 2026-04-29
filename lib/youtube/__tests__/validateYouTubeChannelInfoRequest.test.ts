import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateYouTubeChannelInfoRequest } from "@/lib/youtube/validateYouTubeChannelInfoRequest";
import { validateYouTubeTokens } from "@/lib/youtube/validateYouTubeTokens";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/youtube/validateYouTubeTokens", () => ({
  validateYouTubeTokens: vi.fn(),
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

describe("validateYouTubeChannelInfoRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 with tokenStatus=missing_param when artist_account_id is missing", async () => {
    const result = await validateYouTubeChannelInfoRequest(buildRequest(""));

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      error: "Missing artist_account_id parameter",
      tokenStatus: "missing_param",
    });
    expect(validateYouTubeTokens).not.toHaveBeenCalled();
  });

  it("returns 200 with tokenStatus=invalid when tokens are not found", async () => {
    vi.mocked(validateYouTubeTokens).mockResolvedValue(null);

    const result = await validateYouTubeChannelInfoRequest(
      buildRequest(`?artist_account_id=${ARTIST_ID}`),
    );

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      error: "YouTube authentication required",
      tokenStatus: "invalid",
      channels: null,
    });
  });

  it("returns 200 with tokenStatus=invalid when tokens are expired and refresh fails", async () => {
    // validateYouTubeTokens collapses expired-no-refresh and refresh-fail to null.
    vi.mocked(validateYouTubeTokens).mockResolvedValue(null);

    const result = await validateYouTubeChannelInfoRequest(
      buildRequest(`?artist_account_id=${ARTIST_ID}`),
    );

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tokenStatus).toBe("invalid");
  });

  it("returns the validated payload when tokens resolve (happy path)", async () => {
    vi.mocked(validateYouTubeTokens).mockResolvedValue(validTokens);

    const result = await validateYouTubeChannelInfoRequest(
      buildRequest(`?artist_account_id=${ARTIST_ID}`),
    );

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ artist_account_id: ARTIST_ID, tokens: validTokens });
  });

  it("returns the validated payload after a successful refresh", async () => {
    // validator surface only sees the post-refresh tokens; refresh details
    // live in validateYouTubeTokens.
    const refreshedTokens = { ...validTokens, access_token: "refreshed-abc" };
    vi.mocked(validateYouTubeTokens).mockResolvedValue(refreshedTokens);

    const result = await validateYouTubeChannelInfoRequest(
      buildRequest(`?artist_account_id=${ARTIST_ID}`),
    );

    expect(result).toEqual({ artist_account_id: ARTIST_ID, tokens: refreshedTokens });
  });
});
