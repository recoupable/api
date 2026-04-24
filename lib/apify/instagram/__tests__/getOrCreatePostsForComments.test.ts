import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrCreatePostsForComments } from "../getOrCreatePostsForComments";
import { insertPosts } from "@/lib/supabase/posts/insertPosts";
import { getPostsByUrls } from "@/lib/supabase/posts/getPostsByUrls";

vi.mock("@/lib/supabase/posts/insertPosts", () => ({ insertPosts: vi.fn() }));
vi.mock("@/lib/supabase/posts/getPostsByUrls", () => ({ getPostsByUrls: vi.fn() }));

describe("getOrCreatePostsForComments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty map for empty input and does not touch DB", async () => {
    const result = await getOrCreatePostsForComments([]);
    expect(result.size).toBe(0);
    expect(insertPosts).not.toHaveBeenCalled();
    expect(getPostsByUrls).not.toHaveBeenCalled();
  });

  it("inserts only the URLs missing from Supabase", async () => {
    const existing = [{ id: "p1", post_url: "u1" }] as never;
    const afterInsert = [
      { id: "p1", post_url: "u1" },
      { id: "p2", post_url: "u2" },
    ] as never;

    vi.mocked(getPostsByUrls).mockResolvedValueOnce(existing).mockResolvedValueOnce(afterInsert);

    const result = await getOrCreatePostsForComments(["u1", "u2", "u2"]);

    expect(insertPosts).toHaveBeenCalledWith([expect.objectContaining({ post_url: "u2" })]);
    expect(result.get("u1")).toEqual(existing[0]);
    expect(result.get("u2")).toEqual(afterInsert[1]);
  });

  it("skips insert when all posts already exist", async () => {
    const existing = [{ id: "p1", post_url: "u1" }] as never;
    vi.mocked(getPostsByUrls).mockResolvedValue(existing);

    await getOrCreatePostsForComments(["u1"]);

    expect(insertPosts).not.toHaveBeenCalled();
  });
});
