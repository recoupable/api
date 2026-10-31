import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getPostStatsHandler } from "../getPostStatsHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";
import { findConnectedAccountId } from "@/lib/publishing/findConnectedAccountId";
import { getLinkedInPostStats } from "@/lib/publishing/stats/getLinkedInPostStats";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { chargePostStatsRead } from "@/lib/publishing/stats/chargePostStatsRead";
import { POST_STATS_CREDITS } from "@/lib/publishing/stats/postStatsCredits";

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
  ensureCreditsOrShortCircuit: vi.fn(),
}));
vi.mock("@/lib/publishing/stats/chargePostStatsRead", () => ({ chargePostStatsRead: vi.fn() }));

const callerId = "550e8400-e29b-41d4-a716-446655440000";
const postId = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";
const postUrl = "https://www.linkedin.com/feed/update/urn:li:ugcPost:77/";
const request = () => new NextRequest(`http://localhost/api/posts/${postId}/stats`);
const row = {
  id: postId,
  account_id: "770e8400-e29b-41d4-a716-446655440000",
  artist_account_id: null,
  platform: "linkedin",
  status: "posted",
  post_url: postUrl,
  sub_account_id: "urn:li:organization:42",
};

describe("getPostStatsHandler: credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: callerId,
      orgId: null,
      authToken: "t",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(true);
    vi.mocked(selectScheduledPosts).mockResolvedValue([row] as never);
    vi.mocked(findConnectedAccountId).mockResolvedValue("ca_1");
    vi.mocked(getLinkedInPostStats).mockResolvedValue({
      impressions: 1,
      unique_impressions: 1,
      clicks: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagement: 0,
    });
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(null);
  });

  it("costs $0.001", () => {
    expect(POST_STATS_CREDITS).toBe(1000);
  });

  it("checks the caller's credits, then charges them once after a successful read", async () => {
    const res = await getPostStatsHandler(request(), postId);
    expect(res.status).toBe(200);
    expect(ensureCreditsOrShortCircuit).toHaveBeenCalledWith({
      accountId: callerId,
      creditsToDeduct: POST_STATS_CREDITS,
    });
    expect(chargePostStatsRead).toHaveBeenCalledTimes(1);
    expect(chargePostStatsRead).toHaveBeenCalledWith(callerId, "linkedin", postUrl);
  });

  it("returns the 402 without reading LinkedIn when credits are short", async () => {
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 402 }),
    );
    const res = await getPostStatsHandler(request(), postId);
    expect(res.status).toBe(402);
    expect(getLinkedInPostStats).not.toHaveBeenCalled();
    expect(chargePostStatsRead).not.toHaveBeenCalled();
  });

  it("does not charge when LinkedIn rejects the read", async () => {
    vi.mocked(getLinkedInPostStats).mockRejectedValue(new Error("403"));
    const res = await getPostStatsHandler(request(), postId);
    expect(res.status).toBe(502);
    expect(chargePostStatsRead).not.toHaveBeenCalled();
  });

  it("does not check or charge credits for a request it rejects", async () => {
    vi.mocked(selectScheduledPosts).mockResolvedValue([{ ...row, platform: "youtube" }] as never);
    const res = await getPostStatsHandler(request(), postId);
    expect(res.status).toBe(422);
    expect(ensureCreditsOrShortCircuit).not.toHaveBeenCalled();
    expect(chargePostStatsRead).not.toHaveBeenCalled();
  });
});
