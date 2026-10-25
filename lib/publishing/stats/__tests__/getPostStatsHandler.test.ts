import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getPostStatsHandler } from "../getPostStatsHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";
import { findConnectedAccountId } from "@/lib/publishing/findConnectedAccountId";
import { getLinkedInPostStats } from "@/lib/publishing/stats/getLinkedInPostStats";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_posts/selectScheduledPosts", () => ({
  selectScheduledPosts: vi.fn(),
}));
vi.mock("@/lib/publishing/findConnectedAccountId", () => ({ findConnectedAccountId: vi.fn() }));
vi.mock("@/lib/publishing/stats/getLinkedInPostStats", () => ({ getLinkedInPostStats: vi.fn() }));
vi.mock("@/lib/publishing/stats/getLinkedInVideoStats", () => ({
  getLinkedInVideoStats: vi.fn(),
}));
vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/publishing/stats/chargePostStatsRead", () => ({ chargePostStatsRead: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const artistId = "660e8400-e29b-41d4-a716-446655440000";
const postId = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";
const postUrl = "https://www.linkedin.com/feed/update/urn:li:ugcPost:77/";
const request = () => new NextRequest(`http://localhost/api/posts/${postId}/stats`);
const row = {
  id: postId,
  account_id: accountId,
  artist_account_id: artistId,
  platform: "linkedin",
  status: "posted",
  post_url: postUrl,
  sub_account_id: "urn:li:organization:42",
};
const metrics = {
  impressions: 900,
  unique_impressions: 700,
  clicks: 30,
  likes: 12,
  comments: 3,
  shares: 2,
  engagement: 0.05,
};
const withRow = (patch: Record<string, unknown>) =>
  vi.mocked(selectScheduledPosts).mockResolvedValueOnce([{ ...row, ...patch }] as never);

describe("getPostStatsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "t" });
    vi.mocked(canAccessAccount).mockResolvedValue(true);
    vi.mocked(selectScheduledPosts).mockResolvedValue([row] as never);
    vi.mocked(findConnectedAccountId).mockResolvedValue("ca_1");
    vi.mocked(getLinkedInPostStats).mockResolvedValue(metrics);
  });

  it("returns the post's LinkedIn numbers read through the publishing connection", async () => {
    const res = await getPostStatsHandler(request(), postId);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.stats).toMatchObject({ post_id: postId, platform: "linkedin", post_url: postUrl });
    expect(body.stats).toMatchObject(metrics);
    expect(Number.isNaN(Date.parse(body.stats.as_of))).toBe(false);
    expect(findConnectedAccountId).toHaveBeenCalledWith(artistId, "linkedin");
    expect(getLinkedInPostStats).toHaveBeenCalledWith("ca_1", "urn:li:organization:42", {
      urn: "urn:li:ugcPost:77",
      kind: "ugcPosts",
    });
  });

  it("falls back to the post's account connection without an artist", async () => {
    withRow({ artist_account_id: null });
    await getPostStatsHandler(request(), postId);
    expect(findConnectedAccountId).toHaveBeenCalledWith(accountId, "linkedin");
  });

  it("returns 400 for a malformed id without auth", async () => {
    const res = await getPostStatsHandler(request(), "nope");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("id must be a valid UUID");
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 404 when missing and 403 without access", async () => {
    vi.mocked(selectScheduledPosts).mockResolvedValueOnce([]);
    expect((await getPostStatsHandler(request(), postId)).status).toBe(404);
    vi.mocked(canAccessAccount).mockResolvedValueOnce(false);
    expect((await getPostStatsHandler(request(), postId)).status).toBe(403);
  });

  it("returns 409 when the post is not posted or has no URL", async () => {
    withRow({ status: "scheduled" });
    expect((await getPostStatsHandler(request(), postId)).status).toBe(409);
    withRow({ post_url: null });
    expect((await getPostStatsHandler(request(), postId)).status).toBe(409);
  });

  it("returns 422 for other platforms, member posts and URLs without a post URN", async () => {
    withRow({ platform: "youtube", post_url: "https://youtu.be/x" });
    expect((await getPostStatsHandler(request(), postId)).status).toBe(422);
    withRow({ sub_account_id: null });
    expect((await getPostStatsHandler(request(), postId)).status).toBe(422);
    withRow({ sub_account_id: "urn:li:person:abc" });
    expect((await getPostStatsHandler(request(), postId)).status).toBe(422);
    withRow({ post_url: "https://www.linkedin.com/posts/x" });
    expect((await getPostStatsHandler(request(), postId)).status).toBe(422);
    expect(getLinkedInPostStats).not.toHaveBeenCalled();
  });

  it("returns 409 when LinkedIn is not connected", async () => {
    vi.mocked(findConnectedAccountId).mockResolvedValueOnce(null);
    const res = await getPostStatsHandler(request(), postId);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("linkedin is not connected for this account");
  });

  it("returns 502 without echoing LinkedIn's error when the read is rejected", async () => {
    vi.mocked(getLinkedInPostStats).mockRejectedValueOnce(new Error("returned 403: token abc"));
    const res = await getPostStatsHandler(request(), postId);
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("token abc");
  });

  it("returns 500 when the lookup fails", async () => {
    vi.mocked(selectScheduledPosts).mockRejectedValueOnce(new Error("db down"));
    expect((await getPostStatsHandler(request(), postId)).status).toBe(500);
  });
});
