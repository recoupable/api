import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetSocialPostsRequest } from "../validateGetSocialPostsRequest";

const mockValidateAuthContext = vi.fn();
const mockSelectSocials = vi.fn();
const mockCheckAccountSocialAccess = vi.fn();

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

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { headers: { authorization: "Bearer test-token" } });
}

describe("validateGetSocialPostsRequest", () => {
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

  it("returns 401 when auth fails, short-circuiting validation", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );
    const req = new NextRequest("https://ex.com/api/socials/not-a-uuid/posts");
    const result = await validateGetSocialPostsRequest(req, "not-a-uuid");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(mockSelectSocials).not.toHaveBeenCalled();
  });

  it.each([
    ["not-a-uuid", undefined, ["social_id"]],
    [VALID_UUID, "?page=0", ["page"]],
    [VALID_UUID, "?limit=-1", ["limit"]],
  ])("returns 400 for invalid input (id=%s, query=%s)", async (id, query, path) => {
    const req = makeRequest(`https://ex.com/api/socials/${id}/posts${query ?? ""}`);
    const result = await validateGetSocialPostsRequest(req, id);
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.missing_fields).toEqual(path);
  });

  it("returns 404 when social is missing", async () => {
    mockSelectSocials.mockResolvedValue([]);
    const req = makeRequest(`https://ex.com/api/socials/${VALID_UUID}/posts`);
    const result = await validateGetSocialPostsRequest(req, VALID_UUID);
    expect((result as NextResponse).status).toBe(404);
    expect(mockCheckAccountSocialAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when caller lacks access", async () => {
    mockCheckAccountSocialAccess.mockResolvedValue(false);
    const req = makeRequest(`https://ex.com/api/socials/${VALID_UUID}/posts`);
    const result = await validateGetSocialPostsRequest(req, VALID_UUID);
    expect((result as NextResponse).status).toBe(403);
    expect(mockCheckAccountSocialAccess).toHaveBeenCalledWith("auth-account", VALID_UUID);
  });

  it("defaults: page=1 limit=20 latestFirst=true; clamps limit>100 to 100", async () => {
    const req1 = makeRequest(`https://ex.com/api/socials/${VALID_UUID}/posts`);
    const res1 = await validateGetSocialPostsRequest(req1, VALID_UUID);
    expect(res1).not.toBeInstanceOf(NextResponse);
    if (!(res1 instanceof NextResponse)) {
      expect(res1).toEqual({
        social_id: VALID_UUID,
        latestFirst: true,
        page: 1,
        limit: 20,
      });
    }

    const req2 = makeRequest(`https://ex.com/api/socials/${VALID_UUID}/posts?limit=500&page=3`);
    const res2 = await validateGetSocialPostsRequest(req2, VALID_UUID);
    if (!(res2 instanceof NextResponse)) {
      expect(res2.limit).toBe(100);
      expect(res2.page).toBe(3);
    }
  });

  it.each([
    ["absent", undefined, true],
    ["true", "true", true],
    ["false", "false", false],
    ["0", "0", true],
    ["empty", "", true],
  ])("latestFirst semantics (%s → %s)", async (_label, raw, expected) => {
    const q = raw === undefined ? "" : `?latestFirst=${encodeURIComponent(raw)}`;
    const req = makeRequest(`https://ex.com/api/socials/${VALID_UUID}/posts${q}`);
    const result = await validateGetSocialPostsRequest(req, VALID_UUID);
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.latestFirst).toBe(expected);
    }
  });
});
