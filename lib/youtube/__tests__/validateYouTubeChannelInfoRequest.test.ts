import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateYouTubeChannelInfoRequest } from "@/lib/youtube/validateYouTubeChannelInfoRequest";
import { validateYouTubeTokens } from "@/lib/youtube/validateYouTubeTokens";

const mockValidateAuthContext = vi.fn();
const mockCheckAccountArtistAccess = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: (...args: unknown[]) => mockCheckAccountArtistAccess(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/youtube/validateYouTubeTokens", () => ({
  validateYouTubeTokens: vi.fn(),
}));

const ARTIST_ID = "11111111-1111-1111-1111-111111111111";

const buildRequest = (search: string) =>
  new NextRequest(`https://example.com/api/youtube/channel-info${search}`, {
    headers: { authorization: "Bearer test-token" },
  });

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
    mockValidateAuthContext.mockResolvedValue({
      accountId: "auth-account",
      orgId: null,
      authToken: "t",
    });
    mockCheckAccountArtistAccess.mockResolvedValue(true);
  });

  it("returns 401 when auth fails, short-circuiting validation", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );

    const result = await validateYouTubeChannelInfoRequest(
      buildRequest(`?artist_account_id=${ARTIST_ID}`),
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(mockCheckAccountArtistAccess).not.toHaveBeenCalled();
    expect(validateYouTubeTokens).not.toHaveBeenCalled();
  });

  it("returns 400 when artist_account_id is missing", async () => {
    const result = await validateYouTubeChannelInfoRequest(buildRequest(""));

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      status: "error",
      message: "artist_account_id is required",
    });
    expect(validateYouTubeTokens).not.toHaveBeenCalled();
  });

  it("returns 403 when caller lacks access to the artist", async () => {
    mockCheckAccountArtistAccess.mockResolvedValue(false);

    const result = await validateYouTubeChannelInfoRequest(
      buildRequest(`?artist_account_id=${ARTIST_ID}`),
    );

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ status: "error", message: "forbidden" });
    expect(mockCheckAccountArtistAccess).toHaveBeenCalledWith("auth-account", ARTIST_ID);
    expect(validateYouTubeTokens).not.toHaveBeenCalled();
  });

  // The validator is the single catch boundary: every unusable-token case
  // (no row, expired-no-refresh, refresh failure, db error) collapses
  // into the same response shape.
  it.each([
    ["no token row", new Error("youtube tokens not found")],
    ["expired with no refresh_token", new Error("youtube tokens expired with no refresh_token")],
    ["refresh failure (invalid_grant)", new Error("invalid_grant")],
    ["db update failure", new Error("Failed to update refreshed tokens in DB")],
  ])(
    "returns 401 with re-auth message when validateYouTubeTokens throws (%s)",
    async (_label, err) => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(validateYouTubeTokens).mockRejectedValue(err);

      const result = await validateYouTubeChannelInfoRequest(
        buildRequest(`?artist_account_id=${ARTIST_ID}`),
      );

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({
        status: "error",
        message: "YouTube authentication required",
      });
      expect(errorSpy).toHaveBeenCalledWith(
        `YouTube token validation/refresh failed for account ${ARTIST_ID}:`,
        expect.any(Error),
      );
      errorSpy.mockRestore();
    },
  );

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
