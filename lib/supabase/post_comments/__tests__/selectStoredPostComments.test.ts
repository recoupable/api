import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectStoredPostComments } from "../selectStoredPostComments";
const { from, query } = vi.hoisted(() => {
  const query = { select: vi.fn(), in: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() };
  return { from: vi.fn(), query };
});
vi.mock("@/lib/supabase/serverClient", () => ({ default: { from } }));
const row = {
  id: "id",
  post_id: "post",
  social_id: null,
  comment: null,
  commented_at: "2026-10-10T00:00:00Z",
  posts: { social_posts: [{ social_id: "creator" }] },
};
beforeEach(() => {
  vi.resetAllMocks();
  from.mockReturnValue(query);
  for (const key of ["select", "in", "eq", "order"] as const) query[key].mockReturnValue(query);
  query.range.mockResolvedValue({ data: [row], count: 1, error: null });
});
describe("scoped stored-comment query", () => {
  it("scopes through the post owner's socials, never the commenter, and strips join fields", async () => {
    const result = await selectStoredPostComments({ socialIds: ["creator"], page: 1, limit: 10 });
    expect(from).toHaveBeenCalledWith("post_comments");
    expect(query.select).toHaveBeenCalledWith(
      "id,post_id,social_id,comment,commented_at,posts!inner(social_posts!inner(social_id))",
      { count: "exact" },
    );
    expect(query.in).toHaveBeenCalledWith("posts.social_posts.social_id", ["creator"]);
    expect(query.in).not.toHaveBeenCalledWith("social_id", expect.anything());
    expect(result).toEqual({
      comments: [
        {
          id: "id",
          post_id: "post",
          social_id: null,
          comment: null,
          commented_at: "2026-10-10T00:00:00Z",
        },
      ],
      totalCount: 1,
    });
  });
  it("never sends an unscoped query for an empty social set", async () => {
    expect(await selectStoredPostComments({ socialIds: [], page: 1, limit: 10 })).toEqual({
      comments: [],
      totalCount: 0,
    });
    expect(from).not.toHaveBeenCalled();
  });
  it("adds post filtering without replacing ownership and orders timestamp ties by UUID", async () => {
    await selectStoredPostComments({ socialIds: ["creator"], postId: "post", page: 3, limit: 10 });
    expect(query.in).toHaveBeenCalledWith("posts.social_posts.social_id", ["creator"]);
    expect(query.eq).toHaveBeenCalledWith("post_id", "post");
    expect(query.order.mock.calls).toEqual([
      ["commented_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(query.range).toHaveBeenCalledWith(20, 29);
  });
  it("preserves exact totals on a page beyond the last result", async () => {
    query.range.mockResolvedValue({ data: [], count: 12, error: null });
    expect(await selectStoredPostComments({ socialIds: ["creator"], page: 3, limit: 10 })).toEqual({
      comments: [],
      totalCount: 12,
    });
  });
  it("propagates failures rather than pretending comments are empty", async () => {
    query.range.mockResolvedValue({ data: null, count: null, error: { message: "failure" } });
    await expect(
      selectStoredPostComments({ socialIds: ["creator"], page: 1, limit: 10 }),
    ).rejects.toBeTruthy();
  });
  it("does not invent a zero total when the exact-count response is absent", async () => {
    query.range.mockResolvedValue({ data: [row], count: null, error: null });
    await expect(
      selectStoredPostComments({ socialIds: ["creator"], page: 1, limit: 10 }),
    ).rejects.toBeTruthy();
  });
});
