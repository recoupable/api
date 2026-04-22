import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetPostsRequest } from "../validateGetPostsRequest";

const mockValidateAuthContext = vi.fn();
const mockSelectAccounts = vi.fn();
const mockCheckAccountArtistAccess = vi.fn();

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

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { headers: { authorization: "Bearer test-token" } });
}

describe("validateGetPostsRequest", () => {
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

  it("returns 401 when auth fails, short-circuiting validation", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );
    const req = new NextRequest("https://ex.com/api/artists/not-a-uuid/posts");
    const result = await validateGetPostsRequest(req, "not-a-uuid");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(mockSelectAccounts).not.toHaveBeenCalled();
  });

  it.each([
    ["not-a-uuid", undefined, ["artist_account_id"]],
    [VALID_UUID, "?page=0", ["page"]],
    [VALID_UUID, "?page=-1", ["page"]],
  ])("returns 400 for invalid input (id=%s, query=%s)", async (id, query, path) => {
    const req = makeRequest(`https://ex.com/api/artists/${id}/posts${query ?? ""}`);
    const result = await validateGetPostsRequest(req, id);
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.missing_fields).toEqual(path);
  });

  it("returns 404 when artist account is missing", async () => {
    mockSelectAccounts.mockResolvedValue([]);
    const req = makeRequest(`https://ex.com/api/artists/${VALID_UUID}/posts`);
    const result = await validateGetPostsRequest(req, VALID_UUID);
    expect((result as NextResponse).status).toBe(404);
    expect(mockCheckAccountArtistAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when caller lacks access", async () => {
    mockCheckAccountArtistAccess.mockResolvedValue(false);
    const req = makeRequest(`https://ex.com/api/artists/${VALID_UUID}/posts`);
    const result = await validateGetPostsRequest(req, VALID_UUID);
    expect((result as NextResponse).status).toBe(403);
    expect(mockCheckAccountArtistAccess).toHaveBeenCalledWith("auth-account", VALID_UUID);
  });

  it("defaults page=1 limit=20 and clamps limit>100 to 100", async () => {
    const req1 = makeRequest(`https://ex.com/api/artists/${VALID_UUID}/posts`);
    const res1 = await validateGetPostsRequest(req1, VALID_UUID);
    expect(res1).not.toBeInstanceOf(NextResponse);
    if (!(res1 instanceof NextResponse)) {
      expect(res1).toEqual({ artist_account_id: VALID_UUID, page: 1, limit: 20 });
    }

    const req2 = makeRequest(`https://ex.com/api/artists/${VALID_UUID}/posts?limit=500&page=3`);
    const res2 = await validateGetPostsRequest(req2, VALID_UUID);
    if (!(res2 instanceof NextResponse)) {
      expect(res2.limit).toBe(100);
      expect(res2.page).toBe(3);
    }
  });
});
