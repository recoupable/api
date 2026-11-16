import { describe, it, expect, vi, beforeEach } from "vitest";
import { getArtistPosts } from "../getArtistPosts";
import { selectPosts } from "@/lib/supabase/posts/selectPosts";

vi.mock("@/lib/supabase/posts/selectPosts", () => ({ selectPosts: vi.fn() }));

const ARTIST_ID = "660e8400-e29b-41d4-a716-446655440000";
const POST = { id: "p1", post_url: "https://www.instagram.com/p/abc" };

describe("getArtistPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the posts envelope with total_pages rounded up", async () => {
    vi.mocked(selectPosts).mockResolvedValue({ posts: [POST], totalCount: 45 } as never);
    const result = await getArtistPosts({ artistAccountId: ARTIST_ID, page: 2, limit: 20 });
    expect(selectPosts).toHaveBeenCalledWith({ artistAccountId: ARTIST_ID, page: 2, limit: 20 });
    expect(result).toEqual({
      status: "success",
      posts: [POST],
      pagination: { total_count: 45, page: 2, limit: 20, total_pages: 3 },
    });
  });

  it("reports one page when there are no posts", async () => {
    vi.mocked(selectPosts).mockResolvedValue({ posts: [], totalCount: 0 } as never);
    const result = await getArtistPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 20 });
    expect(result.pagination.total_pages).toBe(1);
  });
});
