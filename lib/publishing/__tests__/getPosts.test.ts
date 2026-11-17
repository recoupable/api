import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPosts } from "../getPosts";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";

vi.mock("@/lib/supabase/scheduled_posts/selectScheduledPosts", () => ({
  selectScheduledPosts: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const artistId = "660e8400-e29b-41d4-a716-446655440000";
const row = {
  id: "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c",
  account_id: accountId,
  artist_account_id: artistId,
  platform: "linkedin",
  status: "posted",
  post_url: "https://www.linkedin.com/feed/update/urn:li:ugcPost:77/",
  workflow_run_id: "wrun_internal",
  created_by_account_id: accountId,
};

describe("getPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectScheduledPosts).mockResolvedValue([row] as never);
  });

  it("reads the account's posts with every filter and maps them to the public shape", async () => {
    const posts = await getPosts({
      accountId,
      artistAccountId: artistId,
      status: "posted",
      platform: "linkedin",
      limit: 5,
      offset: 10,
    });
    expect(selectScheduledPosts).toHaveBeenCalledWith({
      accountId,
      artistAccountId: artistId,
      status: "posted",
      platform: "linkedin",
      limit: 5,
      offset: 10,
    });
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ id: row.id, platform: "linkedin", post_url: row.post_url });
    expect(posts[0]).not.toHaveProperty("workflow_run_id");
    expect(posts[0]).not.toHaveProperty("created_by_account_id");
  });

  it("propagates database errors to the caller", async () => {
    vi.mocked(selectScheduledPosts).mockRejectedValue(new Error("db down"));
    await expect(getPosts({ accountId, limit: 20, offset: 0 })).rejects.toThrow("db down");
  });
});
