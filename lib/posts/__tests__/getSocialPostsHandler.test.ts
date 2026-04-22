import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getSocialPostsHandler } from "../getSocialPostsHandler";

const mockGetSocialPosts = vi.fn();
const mockValidate = vi.fn();

vi.mock("@/lib/posts/getSocialPosts", () => ({
  getSocialPosts: (...args: unknown[]) => mockGetSocialPosts(...args),
}));

vi.mock("@/lib/posts/validateGetSocialPostsRequest", () => ({
  validateGetSocialPostsRequest: (...args: unknown[]) => mockValidate(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const SOCIAL_ID = "11111111-1111-4111-8111-111111111111";
const validated = { social_id: SOCIAL_ID, latestFirst: true, page: 1, limit: 20 };
const okBody = {
  status: "success" as const,
  posts: [{ id: "sp1", post_id: "p1", social_id: SOCIAL_ID, post_url: "u", updated_at: "t" }],
  pagination: { total_count: 1, page: 1, limit: 20, total_pages: 1 },
};

const makeRequest = (url = `https://example.com/api/socials/${SOCIAL_ID}/posts`) =>
  new NextRequest(url, { headers: { authorization: "Bearer t" } });

describe("getSocialPostsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockResolvedValue(validated);
    mockGetSocialPosts.mockResolvedValue(okBody);
  });

  it("returns 200 with the posts envelope and CORS headers on success", async () => {
    const res = await getSocialPostsHandler(makeRequest(), SOCIAL_ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual(okBody);
    expect(mockGetSocialPosts).toHaveBeenCalledWith(validated);
  });

  it("returns the validator's response on failure (401/400/403/404)", async () => {
    const err = NextResponse.json({ status: "error", error: "e" }, { status: 401 });
    mockValidate.mockResolvedValue(err);
    const res = await getSocialPostsHandler(makeRequest(), SOCIAL_ID);
    expect(res).toBe(err);
    expect(mockGetSocialPosts).not.toHaveBeenCalled();
  });

  it("returns 500 with a generic error when an unexpected error is thrown", async () => {
    mockGetSocialPosts.mockRejectedValue(new Error("db down: 10.0.0.1:5432"));
    const res = await getSocialPostsHandler(makeRequest(), SOCIAL_ID);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ status: "error", error: "Internal server error" });
    // Guard: generic message — never leaks underlying error details.
    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
    expect(JSON.stringify(body)).not.toContain("db down");
  });
});
