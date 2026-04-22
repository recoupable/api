import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetSocialPostsRequest } from "../validateGetSocialPostsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { checkAccountSocialAccess } from "@/lib/socials/checkAccountSocialAccess";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/socials/selectSocials", () => ({ selectSocials: vi.fn() }));
vi.mock("@/lib/socials/checkAccountSocialAccess", () => ({
  checkAccountSocialAccess: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const SOCIAL_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const authResult = { accountId: ACCOUNT_ID, authToken: "t", orgId: null };

const makeRequest = (url = `https://example.com/api/socials/${SOCIAL_ID}/posts`) =>
  new NextRequest(url, { headers: { authorization: "Bearer t" } });

describe("validateGetSocialPostsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(authResult);
    vi.mocked(selectSocials).mockResolvedValue([{ id: SOCIAL_ID } as never]);
    vi.mocked(checkAccountSocialAccess).mockResolvedValue(true);
  });

  it.each([
    ["not-a-uuid", `https://example.com/api/socials/not-a-uuid/posts`, "social_id"],
    [SOCIAL_ID, `https://example.com/api/socials/${SOCIAL_ID}/posts?page=0`, "page"],
    [SOCIAL_ID, `https://example.com/api/socials/${SOCIAL_ID}/posts?limit=500`, "limit"],
    [SOCIAL_ID, `https://example.com/api/socials/${SOCIAL_ID}/posts?page=abc`, "page"],
  ])("returns 400 legacy envelope for bad input (%s)", async (id, url, field) => {
    const res = (await validateGetSocialPostsRequest(makeRequest(url), id)) as NextResponse;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.missing_fields).toEqual([field]);
    expect(body.posts).toEqual([]);
    expect(body.pagination).toEqual({ total_count: 0, page: 1, limit: 20, total_pages: 0 });
  });

  it("returns 401 from auth", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(NextResponse.json({}, { status: 401 }));
    const res = (await validateGetSocialPostsRequest(makeRequest(), SOCIAL_ID)) as NextResponse;
    expect(res.status).toBe(401);
    expect(selectSocials).not.toHaveBeenCalled();
  });

  it("returns 404 when the social does not exist", async () => {
    vi.mocked(selectSocials).mockResolvedValue([]);
    const res = (await validateGetSocialPostsRequest(makeRequest(), SOCIAL_ID)) as NextResponse;
    expect(res.status).toBe(404);
    expect(checkAccountSocialAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when caller lacks access", async () => {
    vi.mocked(checkAccountSocialAccess).mockResolvedValue(false);
    const res = (await validateGetSocialPostsRequest(makeRequest(), SOCIAL_ID)) as NextResponse;
    expect(res.status).toBe(403);
    expect(checkAccountSocialAccess).toHaveBeenCalledWith(ACCOUNT_ID, SOCIAL_ID);
  });

  it("applies legacy defaults (latestFirst=true, page=1, limit=20)", async () => {
    const result = await validateGetSocialPostsRequest(makeRequest(), SOCIAL_ID);
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result).toEqual({
        social_id: SOCIAL_ID,
        latestFirst: true,
        page: 1,
        limit: 20,
      });
    }
  });

  it.each([
    ["false", false],
    ["true", true],
    ["1", true],
    ["", true],
    ["banana", true],
  ])("latestFirst=%s → %s (only literal 'false' flips the default)", async (value, expected) => {
    const url = `https://example.com/api/socials/${SOCIAL_ID}/posts?latestFirst=${value}`;
    const result = await validateGetSocialPostsRequest(makeRequest(url), SOCIAL_ID);
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.latestFirst).toBe(expected);
    }
  });
});
