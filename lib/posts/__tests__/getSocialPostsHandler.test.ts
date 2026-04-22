import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getSocialPostsHandler } from "../getSocialPostsHandler";

const mockSelectPosts = vi.fn();
const mockValidateAuthContext = vi.fn();
const mockSelectSocials = vi.fn();
const mockCheckAccountSocialAccess = vi.fn();

vi.mock("@/lib/supabase/posts/selectPosts", () => ({
  selectPosts: (...args: unknown[]) => mockSelectPosts(...args),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));
vi.mock("@/lib/supabase/socials/selectSocials", () => ({
  selectSocials: (...args: unknown[]) => mockSelectSocials(...args),
}));
vi.mock("@/lib/socials/checkAccountSocialAccess", () => ({
  checkAccountSocialAccess: (...args: unknown[]) => mockCheckAccountSocialAccess(...args),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const VALID_UUID = "22222222-2222-4222-8222-222222222222";

function authed(url: string) {
  return new NextRequest(url, { headers: { authorization: "Bearer t" } });
}

describe("getSocialPostsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "auth-account",
      orgId: null,
      authToken: "t",
    });
    mockSelectSocials.mockResolvedValue([{ id: VALID_UUID }]);
    mockCheckAccountSocialAccess.mockResolvedValue(true);
  });

  it("returns 200 with posts passed through as-is", async () => {
    mockSelectPosts.mockResolvedValue({
      posts: [{ id: "p1", post_url: "u", updated_at: "t" }],
      totalCount: 1,
    });
    const res = await getSocialPostsHandler(
      authed(`https://ex.com/api/socials/${VALID_UUID}/posts`),
      VALID_UUID,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = await res.json();
    expect(body).toEqual({
      status: "success",
      posts: [{ id: "p1", post_url: "u", updated_at: "t" }],
      pagination: { total_count: 1, page: 1, limit: 20, total_pages: 1 },
    });
  });

  it("returns 400 passthrough from validator when id is invalid", async () => {
    const res = await getSocialPostsHandler(
      authed("https://ex.com/api/socials/not-a-uuid/posts"),
      "not-a-uuid",
    );
    expect(res.status).toBe(400);
    expect(mockSelectPosts).not.toHaveBeenCalled();
  });

  it("returns 401 passthrough when auth is missing", async () => {
    mockValidateAuthContext.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "no auth" }, { status: 401 }),
    );
    const res = await getSocialPostsHandler(
      new NextRequest(`https://ex.com/api/socials/${VALID_UUID}/posts`),
      VALID_UUID,
    );
    expect(res.status).toBe(401);
    expect(mockSelectPosts).not.toHaveBeenCalled();
  });

  it("returns shared error envelope on unexpected error", async () => {
    mockSelectPosts.mockRejectedValue(new Error("boom"));
    const res = await getSocialPostsHandler(
      authed(`https://ex.com/api/socials/${VALID_UUID}/posts`),
      VALID_UUID,
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ status: "error", error: "Internal server error" });
  });
});
