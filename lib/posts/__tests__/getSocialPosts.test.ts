import { describe, it, expect, vi, beforeEach } from "vitest";

import { getSocialPosts } from "../getSocialPosts";
import { selectSocialPostsCount } from "@/lib/supabase/social_posts/selectSocialPostsCount";
import { selectSocialPostsBySocialId } from "@/lib/supabase/social_posts/selectSocialPostsBySocialId";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { selectPostsByIds } from "@/lib/supabase/posts/selectPostsByIds";

vi.mock("@/lib/supabase/social_posts/selectSocialPostsCount", () => ({
  selectSocialPostsCount: vi.fn(),
}));
vi.mock("@/lib/supabase/social_posts/selectSocialPostsBySocialId", () => ({
  selectSocialPostsBySocialId: vi.fn(),
}));
vi.mock("@/lib/supabase/socials/selectSocials", () => ({ selectSocials: vi.fn() }));
vi.mock("@/lib/supabase/posts/selectPostsByIds", () => ({ selectPostsByIds: vi.fn() }));

const SOCIAL_ID = "11111111-1111-4111-8111-111111111111";
const params = { social_id: SOCIAL_ID, latestFirst: true, page: 1, limit: 20 };

describe("getSocialPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits with empty envelope when count is 0", async () => {
    vi.mocked(selectSocialPostsCount).mockResolvedValue(0);
    const out = await getSocialPosts(params);
    expect(out).toEqual({
      status: "success",
      posts: [],
      pagination: { total_count: 0, page: 1, limit: 20, total_pages: 0 },
    });
    expect(selectSocialPostsBySocialId).not.toHaveBeenCalled();
  });

  it("returns canonical post rows enriched with platform + social_id, ordered by social_posts sequence", async () => {
    vi.mocked(selectSocialPostsCount).mockResolvedValue(2);
    vi.mocked(selectSocialPostsBySocialId).mockResolvedValue([
      { post_id: "p1", social_id: SOCIAL_ID, updated_at: "2024-01-02" },
      { post_id: "p2", social_id: SOCIAL_ID, updated_at: "2024-01-01" },
    ] as never);
    vi.mocked(selectSocials).mockResolvedValue([
      { id: SOCIAL_ID, profile_url: "https://instagram.com/u" },
    ] as never);
    // Intentionally returned in reverse order to verify ordering preservation.
    vi.mocked(selectPostsByIds).mockResolvedValue([
      { id: "p2", post_url: "https://instagram.com/p/2", updated_at: "x" },
      { id: "p1", post_url: "https://instagram.com/p/1", updated_at: "y" },
    ] as never);

    const out = await getSocialPosts(params);

    expect(out.posts.map(p => p.id)).toEqual(["p1", "p2"]);
    expect(out.posts[0]).toMatchObject({
      id: "p1",
      post_url: "https://instagram.com/p/1",
      platform: "INSTAGRAM",
      social_id: SOCIAL_ID,
    });
    expect(out.pagination).toEqual({ total_count: 2, page: 1, limit: 20, total_pages: 1 });
  });

  it("drops social_posts entries with no matching post row", async () => {
    vi.mocked(selectSocialPostsCount).mockResolvedValue(2);
    vi.mocked(selectSocialPostsBySocialId).mockResolvedValue([
      { post_id: "p1", social_id: SOCIAL_ID, updated_at: "2024-01-02" },
      { post_id: "missing", social_id: SOCIAL_ID, updated_at: "2024-01-01" },
    ] as never);
    vi.mocked(selectSocials).mockResolvedValue([
      { id: SOCIAL_ID, profile_url: "https://tiktok.com/u" },
    ] as never);
    vi.mocked(selectPostsByIds).mockResolvedValue([
      { id: "p1", post_url: "https://tiktok.com/p/1", updated_at: "y" },
    ] as never);

    const out = await getSocialPosts(params);
    expect(out.posts.map(p => p.id)).toEqual(["p1"]);
    expect(out.posts[0].platform).toBe("TIKTOK");
  });
});
