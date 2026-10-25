import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getPostStatsHandler } from "../getPostStatsHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";
import { findConnectedAccountId } from "@/lib/publishing/findConnectedAccountId";
import { getLinkedInPostAnalytics } from "@/lib/publishing/stats/getLinkedInPostAnalytics";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { chargePostStatsRead } from "@/lib/publishing/stats/chargePostStatsRead";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_posts/selectScheduledPosts", () => ({
  selectScheduledPosts: vi.fn(),
}));
vi.mock("@/lib/publishing/findConnectedAccountId", () => ({ findConnectedAccountId: vi.fn() }));
vi.mock("@/lib/publishing/stats/getLinkedInPostAnalytics", () => ({
  getLinkedInPostAnalytics: vi.fn(),
}));
vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn(),
}));
vi.mock("@/lib/publishing/stats/chargePostStatsRead", () => ({ chargePostStatsRead: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const postId = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";
const postUrl = "https://www.linkedin.com/feed/update/urn:li:ugcPost:77/";
const request = () => new NextRequest(`http://localhost/api/posts/${postId}/stats`);
const row = {
  id: postId,
  account_id: accountId,
  artist_account_id: null,
  platform: "linkedin",
  status: "posted",
  post_url: postUrl,
  sub_account_id: "urn:li:organization:42",
};
const analytics = {
  impressions: 900,
  unique_impressions: 700,
  clicks: 30,
  likes: 12,
  comments: 3,
  shares: 2,
  engagement: 0.05,
  video_views: 340,
  viewers: 210,
  watch_time_ms: 912000,
};

describe("getPostStatsHandler: video analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "t" });
    vi.mocked(canAccessAccount).mockResolvedValue(true);
    vi.mocked(selectScheduledPosts).mockResolvedValue([row] as never);
    vi.mocked(findConnectedAccountId).mockResolvedValue("ca_1");
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(null);
    vi.mocked(getLinkedInPostAnalytics).mockResolvedValue(analytics);
  });

  it("returns video_views, viewers and watch_time_ms beside the share statistics", async () => {
    const res = await getPostStatsHandler(request(), postId);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.stats).toMatchObject({ post_id: postId, ...analytics });
    expect(getLinkedInPostAnalytics).toHaveBeenCalledWith("ca_1", "urn:li:organization:42", {
      urn: "urn:li:ugcPost:77",
      kind: "ugcPosts",
    });
    expect(chargePostStatsRead).toHaveBeenCalledTimes(1);
  });

  it("returns 502 and charges nothing when the share statistics read is rejected", async () => {
    vi.mocked(getLinkedInPostAnalytics).mockRejectedValueOnce(new Error("returned 403: token"));
    const res = await getPostStatsHandler(request(), postId);
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("token");
    expect(chargePostStatsRead).not.toHaveBeenCalled();
  });
});
