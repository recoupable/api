import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { getArtistFansHandler } from "../getArtistFansHandler";

const mockGetArtistFans = vi.fn();
const mockValidateAuthContext = vi.fn();
const mockSelectAccounts = vi.fn();
const mockCheckAccountArtistAccess = vi.fn();

vi.mock("@/lib/fans/getArtistFans", () => ({
  getArtistFans: (...args: unknown[]) => mockGetArtistFans(...args),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: (...args: unknown[]) => mockSelectAccounts(...args),
}));

vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: (...args: unknown[]) => mockCheckAccountArtistAccess(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function makeAuthedRequest(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { authorization: "Bearer test-token" },
  });
}

describe("getArtistFansHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "auth-account",
      orgId: null,
      authToken: "test-token",
    });
    mockSelectAccounts.mockResolvedValue([{ id: VALID_UUID }]);
    mockCheckAccountArtistAccess.mockResolvedValue(true);
  });

  it("returns 200 with the fans envelope and CORS headers on success", async () => {
    mockGetArtistFans.mockResolvedValue({
      status: "success",
      fans: [{ id: "social-1" }],
      pagination: { total_count: 1, page: 1, limit: 20, total_pages: 1 },
    });

    const req = makeAuthedRequest(`https://example.com/api/artists/${VALID_UUID}/fans`);
    const response = await getArtistFansHandler(req, VALID_UUID);

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.fans).toHaveLength(1);
    expect(body.pagination.total_count).toBe(1);
  });

  it("returns 401 when no auth header or api key is provided", async () => {
    // Real validateAuthContext behavior: no headers = 401.
    // Use the actual implementation for this test by resetting the mock.
    const { NextResponse } = await import("next/server");
    mockValidateAuthContext.mockResolvedValueOnce(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );

    const req = new NextRequest(`https://example.com/api/artists/${VALID_UUID}/fans`);
    const response = await getArtistFansHandler(req, VALID_UUID);

    expect(response.status).toBe(401);
    expect(mockGetArtistFans).not.toHaveBeenCalled();
  });

  it("returns 400 on validation failure (invalid UUID)", async () => {
    const req = makeAuthedRequest("https://example.com/api/artists/not-a-uuid/fans");
    const response = await getArtistFansHandler(req, "not-a-uuid");

    expect(response.status).toBe(400);
    expect(mockGetArtistFans).not.toHaveBeenCalled();
  });

  it("returns 404 when the artist does not exist", async () => {
    mockSelectAccounts.mockResolvedValue([]);
    const req = makeAuthedRequest(`https://example.com/api/artists/${VALID_UUID}/fans`);
    const response = await getArtistFansHandler(req, VALID_UUID);

    expect(response.status).toBe(404);
    expect(mockGetArtistFans).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller lacks access to the artist", async () => {
    mockCheckAccountArtistAccess.mockResolvedValue(false);
    const req = makeAuthedRequest(`https://example.com/api/artists/${VALID_UUID}/fans`);
    const response = await getArtistFansHandler(req, VALID_UUID);

    expect(response.status).toBe(403);
    expect(mockGetArtistFans).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetArtistFans.mockRejectedValue(new Error("boom"));

    const req = makeAuthedRequest(`https://example.com/api/artists/${VALID_UUID}/fans`);
    const response = await getArtistFansHandler(req, VALID_UUID);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.status).toBe("error");
    expect(body.error).toBe("Internal server error");
  });
});
