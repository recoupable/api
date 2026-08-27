import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleInstagramProfileFollowUpRuns } from "../handleInstagramProfileFollowUpRuns";
import { startInstagramCommentsScraping } from "../startInstagramCommentsScraping";
import { getPosts } from "@/lib/supabase/posts/getPosts";
import { registerSpawnedApifyRun } from "@/lib/apify/registerSpawnedApifyRun";
import { guardApifyRunBudget } from "@/lib/apify/guardApifyRunBudget";
import type { ApifyInstagramProfileResult } from "@/lib/apify/types";

vi.mock("../startInstagramCommentsScraping", () => ({ startInstagramCommentsScraping: vi.fn() }));
vi.mock("@/lib/supabase/posts/getPosts", () => ({ getPosts: vi.fn() }));
vi.mock("@/lib/apify/registerSpawnedApifyRun", () => ({ registerSpawnedApifyRun: vi.fn() }));
vi.mock("@/lib/apify/guardApifyRunBudget", () => ({ guardApifyRunBudget: vi.fn() }));

const lineage = { origin: "artist" as const, parentRunId: "run-parent" };
const baseProfile = {
  username: "alice",
  url: "https://instagram.com/alice",
  latestPosts: [],
} as unknown as ApifyInstagramProfileResult;

describe("handleInstagramProfileFollowUpRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(startInstagramCommentsScraping).mockResolvedValue({
      runId: "run-c",
      datasetId: "ds-c",
    });
    vi.mocked(guardApifyRunBudget).mockResolvedValue({ allowed: true });
  });

  it("starts nothing when the run budget guard blocks", async () => {
    vi.mocked(getPosts).mockResolvedValue([]);
    vi.mocked(guardApifyRunBudget).mockResolvedValue({ allowed: false, reason: "per_scrape_cap" });
    await handleInstagramProfileFollowUpRuns(
      {
        ...baseProfile,
        latestPosts: [{ url: "https://instagram.com/p/1" }],
      } as ApifyInstagramProfileResult,
      lineage,
    );
    expect(guardApifyRunBudget).toHaveBeenCalledWith({
      parentRunId: "run-parent",
      platform: "instagram",
    });
    expect(startInstagramCommentsScraping).not.toHaveBeenCalled();
  });

  it("does nothing when latestPosts is empty", async () => {
    await handleInstagramProfileFollowUpRuns({ ...baseProfile, latestPosts: [] }, lineage);
    expect(startInstagramCommentsScraping).not.toHaveBeenCalled();
    expect(getPosts).not.toHaveBeenCalled();
  });

  it("starts one default-depth comments run for unseen posts, stamped with the artist lineage, and registers it under the parent run", async () => {
    vi.mocked(getPosts).mockResolvedValue([]);
    await handleInstagramProfileFollowUpRuns(
      {
        ...baseProfile,
        latestPosts: [{ url: "https://instagram.com/p/1" }],
      } as ApifyInstagramProfileResult,
      lineage,
    );
    expect(startInstagramCommentsScraping).toHaveBeenCalledWith(
      ["https://instagram.com/p/1"],
      undefined,
      lineage,
    );
    expect(registerSpawnedApifyRun).toHaveBeenCalledWith({
      runId: "run-c",
      parentRunId: "run-parent",
      origin: "artist",
      platform: "instagram",
    });
  });

  it("fans out two runs: resultsLimit=1 for seen urls, default for unseen — both carrying lineage", async () => {
    const url1 = "https://instagram.com/p/1";
    const url2 = "https://instagram.com/p/2";
    vi.mocked(getPosts).mockResolvedValue([
      { id: "p1", post_url: url1, post_comments: [{ post_id: "p1" }] },
      { id: "p2", post_url: url2, post_comments: [] },
    ] as never);

    await handleInstagramProfileFollowUpRuns(
      {
        ...baseProfile,
        latestPosts: [{ url: url1 }, { url: url2 }],
      } as ApifyInstagramProfileResult,
      lineage,
    );

    expect(startInstagramCommentsScraping).toHaveBeenCalledTimes(2);
    expect(startInstagramCommentsScraping).toHaveBeenCalledWith([url1], 1, lineage);
    expect(startInstagramCommentsScraping).toHaveBeenCalledWith([url2], undefined, lineage);
    expect(registerSpawnedApifyRun).toHaveBeenCalledTimes(2);
  });
});
