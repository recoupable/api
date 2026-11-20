import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPostStats } from "../getPostStats";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";
import { findConnectedAccountId } from "@/lib/publishing/findConnectedAccountId";
import { getLinkedInPostAnalytics } from "@/lib/publishing/stats/getLinkedInPostAnalytics";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { chargePostStatsRead } from "@/lib/publishing/stats/chargePostStatsRead";
import { POST_STATS_CREDITS } from "@/lib/publishing/stats/postStatsCredits";

vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_posts/selectScheduledPosts", () => ({
  selectScheduledPosts: vi.fn(),
}));
vi.mock("@/lib/publishing/findConnectedAccountId", () => ({ findConnectedAccountId: vi.fn() }));
vi.mock("@/lib/publishing/stats/getLinkedInPostAnalytics", () => ({
  getLinkedInPostAnalytics: vi.fn(),
}));
vi.mock("@/lib/credits/checkCreditsAvailable", () => ({ checkCreditsAvailable: vi.fn() }));
vi.mock("@/lib/publishing/stats/chargePostStatsRead", () => ({ chargePostStatsRead: vi.fn() }));

const callerId = "550e8400-e29b-41d4-a716-446655440000";
const ownerId = "770e8400-e29b-41d4-a716-446655440000";
const artistId = "660e8400-e29b-41d4-a716-446655440000";
const postId = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";
const postUrl = "https://www.linkedin.com/feed/update/urn:li:ugcPost:77/";
const row = {
  id: postId,
  account_id: ownerId,
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
  video_views: null,
  viewers: null,
  watch_time_ms: null,
};
const withRow = (patch: Record<string, unknown>) =>
  vi.mocked(selectScheduledPosts).mockResolvedValueOnce([{ ...row, ...patch }] as never);
const run = () => getPostStats({ accountId: callerId, postId });

describe("getPostStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canAccessAccount).mockResolvedValue(true);
    vi.mocked(selectScheduledPosts).mockResolvedValue([row] as never);
    vi.mocked(findConnectedAccountId).mockResolvedValue("ca_1");
    vi.mocked(checkCreditsAvailable).mockResolvedValue({ kind: "available" });
    vi.mocked(getLinkedInPostAnalytics).mockResolvedValue(metrics);
  });

  it("reads the post's numbers through the publishing connection and charges the caller once", async () => {
    const result = await run();
    expect(selectScheduledPosts).toHaveBeenCalledWith({ id: postId });
    expect(canAccessAccount).toHaveBeenCalledWith({
      currentAccountId: callerId,
      targetAccountId: ownerId,
    });
    expect(findConnectedAccountId).toHaveBeenCalledWith(artistId, "linkedin");
    expect(checkCreditsAvailable).toHaveBeenCalledWith({
      accountId: callerId,
      creditsToDeduct: POST_STATS_CREDITS,
    });
    expect(getLinkedInPostAnalytics).toHaveBeenCalledWith(
      "ca_1",
      "urn:li:organization:42",
      expect.objectContaining({ urn: "urn:li:ugcPost:77" }),
    );
    expect(chargePostStatsRead).toHaveBeenCalledTimes(1);
    expect(chargePostStatsRead).toHaveBeenCalledWith(callerId, "linkedin", postUrl);
    expect(result).toEqual({
      kind: "ok",
      stats: {
        post_id: postId,
        platform: "linkedin",
        post_url: postUrl,
        ...metrics,
        as_of: expect.any(String),
      },
    });
  });

  it("uses the owner's connection when the post has no artist", async () => {
    withRow({ artist_account_id: null });
    await run();
    expect(findConnectedAccountId).toHaveBeenCalledWith(ownerId, "linkedin");
  });

  it.each([
    [
      "an unknown post",
      () => vi.mocked(selectScheduledPosts).mockResolvedValueOnce([]),
      404,
      "Post not found",
    ],
    [
      "a post the caller cannot reach",
      () => vi.mocked(canAccessAccount).mockResolvedValueOnce(false),
      403,
      "Access denied to this post's account",
    ],
    [
      "an unpublished post",
      () => withRow({ status: "scheduled", post_url: null }),
      409,
      "Post is not published yet, so it has no stats",
    ],
    [
      "another platform",
      () => withRow({ platform: "youtube" }),
      422,
      "Stats are not available for youtube posts yet",
    ],
    [
      "a member post",
      () => withRow({ sub_account_id: "urn:li:person:9" }),
      422,
      "Stats are available for LinkedIn company-page posts only",
    ],
    [
      "a URL that names no post",
      () => withRow({ post_url: "https://www.linkedin.com/company/recoup/" }),
      422,
      "post_url does not name a LinkedIn post",
    ],
    [
      "a missing LinkedIn connection",
      () => vi.mocked(findConnectedAccountId).mockResolvedValueOnce(null),
      409,
      "linkedin is not connected for this account",
    ],
  ])("rejects %s without checking or charging credits", async (_name, arrange, status, message) => {
    arrange();
    expect(await run()).toEqual({ kind: "rejected", status, message });
    expect(checkCreditsAvailable).not.toHaveBeenCalled();
    expect(getLinkedInPostAnalytics).not.toHaveBeenCalled();
    expect(chargePostStatsRead).not.toHaveBeenCalled();
  });

  it("reports a credit shortfall without reading LinkedIn", async () => {
    vi.mocked(checkCreditsAvailable).mockResolvedValueOnce({
      kind: "insufficient_credits",
      remainingCredits: 10,
      requiredCredits: POST_STATS_CREDITS,
    });
    expect(await run()).toEqual({
      kind: "insufficient_credits",
      remainingCredits: 10,
      requiredCredits: POST_STATS_CREDITS,
    });
    expect(getLinkedInPostAnalytics).not.toHaveBeenCalled();
    expect(chargePostStatsRead).not.toHaveBeenCalled();
  });

  it("reports a LinkedIn rejection as a 502 without leaking its message or charging", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getLinkedInPostAnalytics).mockRejectedValueOnce(new Error("returned 403: token abc"));
    expect(await run()).toEqual({
      kind: "rejected",
      status: 502,
      message: "LinkedIn rejected the stats read for this post",
    });
    expect(chargePostStatsRead).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("propagates database errors to the caller", async () => {
    vi.mocked(selectScheduledPosts).mockRejectedValueOnce(new Error("db down"));
    await expect(run()).rejects.toThrow("db down");
  });
});
