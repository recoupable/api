import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLinkedInPostAnalytics } from "../getLinkedInPostAnalytics";
import { getLinkedInPostStats } from "@/lib/publishing/stats/getLinkedInPostStats";
import { getLinkedInVideoStats } from "@/lib/publishing/stats/getLinkedInVideoStats";

vi.mock("@/lib/publishing/stats/getLinkedInPostStats", () => ({ getLinkedInPostStats: vi.fn() }));
vi.mock("@/lib/publishing/stats/getLinkedInVideoStats", () => ({
  getLinkedInVideoStats: vi.fn(),
}));

const org = "urn:li:organization:42";
const post = { urn: "urn:li:ugcPost:77", kind: "ugcPosts" as const };
const shareStats = {
  impressions: 900,
  unique_impressions: 700,
  clicks: 30,
  likes: 12,
  comments: 3,
  shares: 2,
  engagement: 0.05,
};
const videoStats = { video_views: 340, viewers: 210, watch_time_ms: 912000 };

describe("getLinkedInPostAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLinkedInPostStats).mockResolvedValue(shareStats);
    vi.mocked(getLinkedInVideoStats).mockResolvedValue(videoStats);
  });

  it("merges share statistics and video analytics read through the same connection", async () => {
    expect(await getLinkedInPostAnalytics("ca_1", org, post)).toEqual({
      ...shareStats,
      ...videoStats,
    });
    expect(getLinkedInPostStats).toHaveBeenCalledWith("ca_1", org, post);
    expect(getLinkedInVideoStats).toHaveBeenCalledWith("ca_1", post.urn);
  });

  it("rejects when the share statistics read is rejected", async () => {
    vi.mocked(getLinkedInPostStats).mockRejectedValueOnce(new Error("returned 403"));
    await expect(getLinkedInPostAnalytics("ca_1", org, post)).rejects.toThrow("returned 403");
  });
});
