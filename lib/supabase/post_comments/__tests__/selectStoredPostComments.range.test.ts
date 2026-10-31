import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectStoredPostComments } from "../selectStoredPostComments";
const { from, query, countQuery } = vi.hoisted(() => ({
  from: vi.fn(),
  query: { select: vi.fn(), in: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() },
  countQuery: { select: vi.fn(), in: vi.fn(), eq: vi.fn(), then: vi.fn() },
}));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { from } }));
const args = { socialIds: ["creator"], postId: "authorized-post", page: 5, limit: 2 };
const rangeError = { code: "PGRST103", message: "Requested range not satisfiable" };
beforeEach(() => {
  vi.resetAllMocks();
  from.mockReturnValueOnce(query).mockReturnValue(countQuery);
  for (const key of ["select", "in", "eq", "order"] as const) query[key].mockReturnValue(query);
  for (const key of ["select", "in", "eq"] as const) countQuery[key].mockReturnValue(countQuery);
  query.range.mockResolvedValue({ data: null, count: null, error: rangeError });
  countQuery.then.mockImplementation(resolve => resolve({ data: null, count: 4, error: null }));
});
describe("stored comment page beyond the end", () => {
  it("returns an empty page using a HEAD count with identical ownership and post filters", async () => {
    expect(await selectStoredPostComments(args)).toEqual({ comments: [], totalCount: 4 });
    expect(from).toHaveBeenCalledTimes(2);
    expect(countQuery.select).toHaveBeenCalledWith(
      "id,post_id,social_id,comment,commented_at,posts!inner(social_posts!inner(social_id))",
      { count: "exact", head: true },
    );
    expect(countQuery.in).toHaveBeenCalledWith("posts.social_posts.social_id", ["creator"]);
    expect(countQuery.eq).toHaveBeenCalledWith("post_id", "authorized-post");
    expect(query.range).toHaveBeenCalledWith(8, 9);
  });
  it("does not fall back for other storage errors", async () => {
    query.range.mockResolvedValue({
      data: null,
      count: null,
      error: { code: "42501", message: "denied" },
    });
    await expect(selectStoredPostComments(args)).rejects.toMatchObject({ code: "42501" });
    expect(from).toHaveBeenCalledTimes(1);
  });
  it("does not hide a failed count as an empty dataset", async () => {
    countQuery.then.mockImplementation(resolve =>
      resolve({ data: null, count: null, error: { message: "count failed" } }),
    );
    await expect(selectStoredPostComments(args)).rejects.toMatchObject({ message: "count failed" });
  });
  it("rejects absent count metadata after the range error", async () => {
    countQuery.then.mockImplementation(resolve =>
      resolve({ data: null, count: null, error: null }),
    );
    await expect(selectStoredPostComments(args)).rejects.toThrow(
      "Stored comment count unavailable",
    );
  });
  it("does not convert a denied scoped HEAD count into a successful empty page", async () => {
    countQuery.then.mockImplementation(resolve =>
      resolve({ data: null, count: null, error: { code: "42501", message: "permission denied" } }),
    );
    await expect(selectStoredPostComments(args)).rejects.toMatchObject({ code: "42501" });
    expect(countQuery.in).toHaveBeenCalledWith("posts.social_posts.social_id", ["creator"]);
    expect(countQuery.eq).toHaveBeenCalledWith("post_id", "authorized-post");
  });
});
