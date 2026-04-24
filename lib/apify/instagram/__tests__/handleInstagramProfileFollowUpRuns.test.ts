import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleInstagramProfileFollowUpRuns } from "../handleInstagramProfileFollowUpRuns";
import { startInstagramCommentsScraping } from "../startInstagramCommentsScraping";
import { getExistingPostComments } from "../getExistingPostComments";
import type { ApifyInstagramProfileResult } from "@/lib/apify/types";

vi.mock("../startInstagramCommentsScraping", () => ({
  startInstagramCommentsScraping: vi.fn(),
}));
vi.mock("../getExistingPostComments", () => ({
  getExistingPostComments: vi.fn(),
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
    expect(getExistingPostComments).not.toHaveBeenCalled();
  });

  it("does not kick off comments scrape when latestPosts is empty", async () => {
    await handleInstagramProfileFollowUpRuns([baseProfile], {
      ...baseProfile,
      latestPosts: [],
    } as ApifyInstagramProfileResult);

    expect(startInstagramCommentsScraping).not.toHaveBeenCalled();
    expect(getExistingPostComments).not.toHaveBeenCalled();
  });

  it("fans out two scrapes: resultsLimit=1 for seen urls, default for unseen", async () => {
    const url1 = "https://instagram.com/p/1";
    const url2 = "https://instagram.com/p/2";

    vi.mocked(getExistingPostComments).mockResolvedValue({
      urlsWithComments: [url1],
      urlsWithoutComments: [url2],
    });

    await handleInstagramProfileFollowUpRuns([baseProfile], {
      ...baseProfile,
      latestPosts: [{ url: url1 }, { url: url2 }],
    } as ApifyInstagramProfileResult);

    expect(startInstagramCommentsScraping).toHaveBeenCalledTimes(2);
    expect(startInstagramCommentsScraping).toHaveBeenCalledWith([url1], 1);
    expect(startInstagramCommentsScraping).toHaveBeenCalledWith([url2]);
  });
});
