import { describe, it, expect, vi, beforeEach } from "vitest";

import { getPosts } from "../getPosts";

const mockSelectAccountSocials = vi.fn();
const mockSelectSocialPostsBySocialIds = vi.fn();
const mockSelectPostsByIds = vi.fn();

vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: (...args: unknown[]) => mockSelectAccountSocials(...args),
}));
vi.mock("@/lib/supabase/social_posts/selectSocialPostsBySocialIds", () => ({
  selectSocialPostsBySocialIds: (...args: unknown[]) => mockSelectSocialPostsBySocialIds(...args),
}));
vi.mock("@/lib/supabase/posts/selectPostsByIds", () => ({
  selectPostsByIds: (...args: unknown[]) => mockSelectPostsByIds(...args),
}));

const ARTIST_ID = "11111111-1111-4111-8111-111111111111";

const accountSocial = (id: string, profile_url: string) => ({
  social: { id, profile_url },
});

describe("getPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty envelope when artist has no socials", async () => {
    mockSelectAccountSocials.mockResolvedValue([]);
    const result = await getPosts({ artist_account_id: ARTIST_ID, page: 1, limit: 20 });
    expect(result.status).toBe("success");
    expect(result.posts).toEqual([]);
    expect(result.pagination).toEqual({ total_count: 0, page: 1, limit: 20, total_pages: 1 });
    expect(mockSelectSocialPostsBySocialIds).not.toHaveBeenCalled();
  });

  it("returns empty envelope when socials exist but have no posts", async () => {
    mockSelectAccountSocials.mockResolvedValue([accountSocial("s1", "https://instagram.com/a")]);
    mockSelectSocialPostsBySocialIds.mockResolvedValue([]);
    const result = await getPosts({ artist_account_id: ARTIST_ID, page: 1, limit: 20 });
    expect(result.posts).toEqual([]);
    expect(result.pagination.total_count).toBe(0);
    expect(mockSelectPostsByIds).not.toHaveBeenCalled();
  });

  it("dedups post_ids across multiple socials and paginates", async () => {
    mockSelectAccountSocials.mockResolvedValue([
      accountSocial("s1", "https://instagram.com/a"),
      accountSocial("s2", "https://tiktok.com/b"),
    ]);
    mockSelectSocialPostsBySocialIds.mockResolvedValue([
      { post_id: "p1", social_id: "s1" },
      { post_id: "p2", social_id: "s1" },
      { post_id: "p1", social_id: "s2" },
      { post_id: "p3", social_id: "s2" },
    ]);
    mockSelectPostsByIds.mockResolvedValue([
      { id: "p1", post_url: "u1", updated_at: "t" },
      { id: "p2", post_url: "u2", updated_at: "t" },
    ]);

    const result = await getPosts({ artist_account_id: ARTIST_ID, page: 1, limit: 2 });
    expect(result.pagination).toEqual({ total_count: 3, page: 1, limit: 2, total_pages: 2 });
    expect(mockSelectPostsByIds).toHaveBeenCalledWith(["p1", "p2"]);
    expect(result.posts.map(p => p.platform)).toEqual(["INSTAGRAM", "INSTAGRAM"]);
  });

  it("returns empty posts for a page past the last page without error", async () => {
    mockSelectAccountSocials.mockResolvedValue([accountSocial("s1", "https://instagram.com/a")]);
    mockSelectSocialPostsBySocialIds.mockResolvedValue([{ post_id: "p1", social_id: "s1" }]);
    mockSelectPostsByIds.mockResolvedValue([]);
    const result = await getPosts({ artist_account_id: ARTIST_ID, page: 5, limit: 20 });
    expect(result.posts).toEqual([]);
    expect(result.pagination.total_count).toBe(1);
    expect(result.pagination.total_pages).toBe(1);
  });
});
