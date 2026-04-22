import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getArtistPostsHandler } from "../getArtistPostsHandler";

const mockGetArtistPosts = vi.fn();
const mockValidateAuthContext = vi.fn();
const mockSelectAccounts = vi.fn();
const mockCheckAccountArtistAccess = vi.fn();

vi.mock("@/lib/posts/getArtistPosts", () => ({
  getArtistPosts: (...args: unknown[]) => mockGetArtistPosts(...args),
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

function authed(url: string) {
  return new NextRequest(url, { headers: { authorization: "Bearer t" } });
}

describe("getArtistPostsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "auth-account",
      orgId: null,
      authToken: "t",
    });
    mockSelectAccounts.mockResolvedValue([{ id: VALID_UUID }]);
    mockCheckAccountArtistAccess.mockResolvedValue(true);
  });

  it("returns 200 with posts envelope on success", async () => {
    mockGetArtistPosts.mockResolvedValue({
      status: "success",
      posts: [{ id: "p1", post_url: "u", updated_at: "t", platform: "INSTAGRAM" }],
      pagination: { total_count: 1, page: 1, limit: 20, total_pages: 1 },
    });
    const res = await getArtistPostsHandler(
      authed(`https://ex.com/api/artists/${VALID_UUID}/posts`),
      VALID_UUID,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = await res.json();
    expect(body.posts).toHaveLength(1);
  });

  it.each([
    [
      "401 when auth is missing",
      (): void => {
        mockValidateAuthContext.mockResolvedValueOnce(
          NextResponse.json({ status: "error", error: "no auth" }, { status: 401 }),
        );
      },
      (): NextRequest => new NextRequest(`https://ex.com/api/artists/${VALID_UUID}/posts`),
      VALID_UUID,
      401,
    ],
    [
      "400 when id is invalid",
      (): void => {},
      (): NextRequest => authed("https://ex.com/api/artists/not-a-uuid/posts"),
      "not-a-uuid",
      400,
    ],
    [
      "404 when artist does not exist",
      (): void => {
        mockSelectAccounts.mockResolvedValue([]);
      },
      (): NextRequest => authed(`https://ex.com/api/artists/${VALID_UUID}/posts`),
      VALID_UUID,
      404,
    ],
    [
      "403 when access is denied",
      (): void => {
        mockCheckAccountArtistAccess.mockResolvedValue(false);
      },
      (): NextRequest => authed(`https://ex.com/api/artists/${VALID_UUID}/posts`),
      VALID_UUID,
      403,
    ],
  ])("returns %s", async (_label, setup, makeReq, id, expectedStatus) => {
    setup();
    const res = await getArtistPostsHandler(makeReq(), id);
    expect(res.status).toBe(expectedStatus);
    expect(mockGetArtistPosts).not.toHaveBeenCalled();
  });

  it("returns shared error envelope on unexpected error", async () => {
    mockGetArtistPosts.mockRejectedValue(new Error("boom"));
    const res = await getArtistPostsHandler(
      authed(`https://ex.com/api/artists/${VALID_UUID}/posts`),
      VALID_UUID,
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ status: "error", error: "Internal server error" });
  });
});
