import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleInstagramProfileFollowUpRuns } from "../handleInstagramProfileFollowUpRuns";
import { startInstagramCommentsScraping } from "../startInstagramCommentsScraping";
import { getPostsWithComments } from "@/lib/supabase/posts/getPostsWithComments";
import type { ApifyInstagramProfileResult } from "@/lib/apify/types";

vi.mock("../startInstagramCommentsScraping", () => ({
  startInstagramCommentsScraping: vi.fn(),
}));
vi.mock("@/lib/supabase/posts/getPostsWithComments", () => ({
  getPostsWithComments: vi.fn(),
}));

const baseProfile: ApifyInstagramProfileResult = {
  username: "alice",
  url: "https://instagram.com/alice",
  profilePicUrl: "",
  profilePicUrlHD: "",
  biography: "",
  followersCount: 0,
  followsCount: 0,
  latestPosts: [],
} as unknown as ApifyInstagramProfileResult;

describe("handleInstagramProfileFollowUpRuns", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not kick off comments scrape when dataset has more than one profile", async () => {
    const dataset = [baseProfile, baseProfile, baseProfile];

    await handleInstagramProfileFollowUpRuns(dataset, {
      ...baseProfile,
      latestPosts: [{ url: "https://instagram.com/p/1" }],
    } as ApifyInstagramProfileResult);

    expect(startInstagramCommentsScraping).not.toHaveBeenCalled();
    expect(getPostsWithComments).not.toHaveBeenCalled();
  });

  it("does not kick off comments scrape when latestPosts is empty", async () => {
    await handleInstagramProfileFollowUpRuns([baseProfile], {
      ...baseProfile,
      latestPosts: [],
    } as ApifyInstagramProfileResult);

    expect(startInstagramCommentsScraping).not.toHaveBeenCalled();
    expect(getPostsWithComments).not.toHaveBeenCalled();
  });

  it("fans out two scrapes: resultsLimit=1 for seen urls, default for unseen", async () => {
    const url1 = "https://instagram.com/p/1";
    const url2 = "https://instagram.com/p/2";

    vi.mocked(getPostsWithComments).mockResolvedValue([
      { id: "p1", post_url: url1, post_comments: [{ post_id: "p1" }] },
      { id: "p2", post_url: url2, post_comments: [] },
    ] as never);

    await handleInstagramProfileFollowUpRuns([baseProfile], {
      ...baseProfile,
      latestPosts: [{ url: url1 }, { url: url2 }],
    } as ApifyInstagramProfileResult);

    expect(startInstagramCommentsScraping).toHaveBeenCalledTimes(2);
    expect(startInstagramCommentsScraping).toHaveBeenCalledWith([url1], 1);
    expect(startInstagramCommentsScraping).toHaveBeenCalledWith([url2]);
  });

  it("backfills comments for all urls when no posts row exists yet", async () => {
    const url1 = "https://instagram.com/p/1";
    vi.mocked(getPostsWithComments).mockResolvedValue([]);

    await handleInstagramProfileFollowUpRuns([baseProfile], {
      ...baseProfile,
      latestPosts: [{ url: url1 }],
    } as ApifyInstagramProfileResult);

    expect(startInstagramCommentsScraping).toHaveBeenCalledOnce();
    expect(startInstagramCommentsScraping).toHaveBeenCalledWith([url1]);
  });
});
