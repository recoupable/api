import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { GET, OPTIONS } from "@/app/api/comments/route";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { selectAccountArtistId } from "@/lib/supabase/account_artist_ids/selectAccountArtistId";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectArtistOrganizationIds } from "@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds";
import { selectAccountOrganizationIds } from "@/lib/supabase/account_organization_ids/selectAccountOrganizationIds";
import { selectAccountSocialIds } from "@/lib/supabase/account_socials/selectAccountSocialIds";
import { selectStoredPostComments } from "@/lib/supabase/post_comments/selectStoredPostComments";
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({ getApiKeyAccountId: vi.fn() }));
vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({ getAuthenticatedAccountId: vi.fn() }));
vi.mock("@/lib/supabase/account_artist_ids/selectAccountArtistId", () => ({
  selectAccountArtistId: vi.fn(),
}));
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));
vi.mock("@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds", () => ({
  selectArtistOrganizationIds: vi.fn(),
}));
vi.mock("@/lib/supabase/account_organization_ids/selectAccountOrganizationIds", () => ({
  selectAccountOrganizationIds: vi.fn(),
}));
vi.mock("@/lib/supabase/account_socials/selectAccountSocialIds", () => ({
  selectAccountSocialIds: vi.fn(),
}));
vi.mock("@/lib/supabase/post_comments/selectStoredPostComments", () => ({
  selectStoredPostComments: vi.fn(),
}));
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({ selectAccounts: vi.fn() }));
const artist = "11111111-1111-4111-8111-111111111111";
const post = "22222222-2222-4222-8222-222222222222";
const comment = {
  id: "comment",
  post_id: post,
  social_id: null,
  comment: null,
  commented_at: "2026-10-10T00:00:00Z",
};
const request = (
  query = `artist_account_id=${artist}`,
  headers: Record<string, string> = { "x-api-key": "dummy" },
) => new NextRequest(`http://localhost/api/comments?${query}`, { headers });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(selectAccounts).mockResolvedValue([{ id: artist, name: null, timestamp: null }]);
  vi.mocked(getApiKeyAccountId).mockResolvedValue("caller");
  vi.mocked(getAuthenticatedAccountId).mockResolvedValue("caller");
  vi.mocked(selectAccountArtistId).mockResolvedValue({
    id: "access",
    artist_id: artist,
    pinned: null,
  });
  vi.mocked(getAccountOrganizations).mockResolvedValue([]);
  vi.mocked(selectArtistOrganizationIds).mockResolvedValue([]);
  vi.mocked(selectAccountOrganizationIds).mockResolvedValue([]);
  vi.mocked(selectAccountSocialIds).mockResolvedValue(["creator-social"]);
  vi.mocked(selectStoredPostComments).mockResolvedValue({ comments: [comment], totalCount: 11 });
});
describe("stored comments route", () => {
  it.each([{}, { "x-api-key": "dummy", authorization: "Bearer dummy" }])(
    "rejects missing or conflicting authentication",
    async headers => {
      expect((await GET(request(undefined, headers))).status).toBe(401);
      expect(selectAccountArtistId).not.toHaveBeenCalled();
      expect(selectStoredPostComments).not.toHaveBeenCalled();
    },
  );
  it.each([{ "x-api-key": "dummy" }, { authorization: "Bearer dummy" }])(
    "uses existing API-key and Bearer auth gates",
    async headers => {
      const response = await GET(request(undefined, headers));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({
        status: "success",
        comments: [comment],
        pagination: { total_count: 11, page: 1, limit: 10, total_pages: 2 },
      });
      expect(selectAccountArtistId).toHaveBeenCalledWith("caller", artist);
      expect(selectStoredPostComments).toHaveBeenCalledWith({
        socialIds: ["creator-social"],
        postId: undefined,
        page: 1,
        limit: 10,
      });
    },
  );
  it("preserves authentication failures without reading comments", async () => {
    vi.mocked(getApiKeyAccountId).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    expect((await GET(request())).status).toBe(401);
    expect(selectStoredPostComments).not.toHaveBeenCalled();
  });
  it.each([
    "",
    "artist_account_id=bad",
    `artist_account_id=${artist}&post_id=https://example.com/post`,
    `artist_account_id=${artist}&page=0`,
    `artist_account_id=${artist}&limit=-1`,
    `artist_account_id=${artist}&page=1.5`,
    `artist_account_id=${artist}&page=99999999999`,
    `artist_account_id=${artist}&account_id=other`,
    `artist_account_id=${artist}&artist_account_id=${post}`,
  ])("rejects invalid or ambiguous input before access/data reads: %s", async query => {
    expect((await GET(request(query))).status).toBe(400);
    expect(selectAccountArtistId).not.toHaveBeenCalled();
    expect(selectStoredPostComments).not.toHaveBeenCalled();
  });
  it("filters the stored post UUID and bounds the effective page size", async () => {
    const response = await GET(
      request(`artist_account_id=${artist}&post_id=${post}&page=2&limit=1000`),
    );
    expect(response.status).toBe(200);
    expect(selectStoredPostComments).toHaveBeenCalledWith({
      socialIds: ["creator-social"],
      postId: post,
      page: 2,
      limit: 100,
    });
  });
  it("denies unrelated callers before reading linked socials or comments", async () => {
    vi.mocked(selectAccountArtistId).mockResolvedValue(null);
    expect((await GET(request())).status).toBe(403);
    expect(selectAccountSocialIds).not.toHaveBeenCalled();
    expect(selectStoredPostComments).not.toHaveBeenCalled();
  });
  it("rechecks access and denies after membership is revoked", async () => {
    vi.mocked(selectAccountArtistId).mockResolvedValue(null);
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue([{ organization_id: "org" }]);
    vi.mocked(selectAccountOrganizationIds)
      .mockResolvedValueOnce([{ organization_id: "org" }])
      .mockResolvedValue([]);
    expect((await GET(request())).status).toBe(200);
    vi.mocked(selectStoredPostComments).mockClear();
    expect((await GET(request())).status).toBe(403);
    expect(selectStoredPostComments).not.toHaveBeenCalled();
  });
  it("supports an organization key only for its own roster", async () => {
    vi.mocked(getApiKeyAccountId).mockResolvedValue("org");
    vi.mocked(selectAccountArtistId).mockResolvedValue(null);
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue([{ organization_id: "org" }]);
    expect((await GET(request())).status).toBe(200);
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue([{ organization_id: "other-org" }]);
    vi.mocked(selectStoredPostComments).mockClear();
    expect((await GET(request())).status).toBe(403);
    expect(selectStoredPostComments).not.toHaveBeenCalled();
  });
  it("allows a creator to read their own linked-post comments", async () => {
    vi.mocked(getApiKeyAccountId).mockResolvedValue(artist);
    expect((await GET(request())).status).toBe(200);
  });
  it("returns an empty page when no linked social accounts exist", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue([]);
    vi.mocked(selectStoredPostComments).mockResolvedValue({ comments: [], totalCount: 0 });
    const response = await GET(request());
    expect(await response.json()).toMatchObject({
      comments: [],
      pagination: { total_count: 0, total_pages: 0 },
    });
  });
  it.each(["social", "comments", "access"])("masks %s lookup failures", async source => {
    const failure = new Error("private database connection detail");
    if (source === "social") vi.mocked(selectAccountSocialIds).mockRejectedValue(failure);
    if (source === "comments") vi.mocked(selectStoredPostComments).mockRejectedValue(failure);
    if (source === "access") vi.mocked(selectAccountArtistId).mockRejectedValue(failure);
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private database");
  });
  it("answers CORS preflight without authenticating or reading", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeTruthy();
    expect(selectStoredPostComments).not.toHaveBeenCalled();
  });
  it("does not read linked socials for a missing creator even when the access gate permits the caller", async () => {
    vi.mocked(selectAccounts).mockResolvedValue([]);
    expect((await GET(request())).status).toBe(403);
    expect(selectAccountSocialIds).not.toHaveBeenCalled();
    expect(selectStoredPostComments).not.toHaveBeenCalled();
  });
});
