import { describe, it, expect, vi, beforeEach } from "vitest";
import supabase from "../../serverClient";
import { selectPosts } from "../selectPosts";
import { selectAccountSocialIds } from "../../account_socials/selectAccountSocialIds";

vi.mock("../../serverClient", () => ({ default: { from: vi.fn() } }));
vi.mock("../../account_socials/selectAccountSocialIds", () => ({
  selectAccountSocialIds: vi.fn(),
}));

const ARTIST_ID = "11111111-1111-4111-8111-111111111111";
const SOCIAL_IDS = ["s1", "s2"];
const ROW = { id: "p1", post_url: "https://x.example/p/1", updated_at: "t", social_posts: [{}] };
const CLEAN = { id: "p1", post_url: "https://x.example/p/1", updated_at: "t" };
const FILTER_COL = "social_posts.social_id";
const JOIN = "social_posts!inner(social_id)";

function mockRows(result: { data: unknown; error: { message: string } | null }) {
  const thenable = { then: (fn: (r: typeof result) => unknown) => fn(result) };
  const inFn = vi.fn().mockReturnValue(thenable);
  const range = vi.fn().mockReturnValue({ in: inFn, ...thenable });
  const order = vi.fn().mockReturnValue({ range });
  const select = vi.fn().mockReturnValue({ order });
  return { select, in: inFn, range, order };
}

function mockCount(result: { count: number; error: { message: string } | null }) {
  const thenable = { then: (fn: (r: typeof result) => unknown) => fn(result) };
  const inFn = vi.fn().mockReturnValue(thenable);
  const select = vi.fn().mockReturnValue({ in: inFn, ...thenable });
  return { select, in: inFn };
}

function wire(rows: ReturnType<typeof mockRows>, count: ReturnType<typeof mockCount>) {
  vi.mocked(supabase.from)
    .mockReturnValueOnce({ select: rows.select } as never)
    .mockReturnValueOnce({ select: count.select } as never);
}

describe("selectPosts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries without filter when artistAccountId is absent", async () => {
    const rows = mockRows({ data: [ROW], error: null });
    const count = mockCount({ count: 3, error: null });
    wire(rows, count);
    const result = await selectPosts({ page: 1, limit: 10 });
    expect(rows.select).toHaveBeenCalledWith(expect.stringContaining(JOIN));
    expect(rows.order).toHaveBeenCalledWith("updated_at", { ascending: false, nullsFirst: false });
    expect(rows.range).toHaveBeenCalledWith(0, 9);
    expect(rows.in).not.toHaveBeenCalled();
    expect(count.in).not.toHaveBeenCalled();
    expect(vi.mocked(selectAccountSocialIds)).not.toHaveBeenCalled();
    expect(result).toEqual({ posts: [CLEAN], totalCount: 3 });
    expect(result.posts[0]).not.toHaveProperty("social_posts");
  });

  it("resolves artist social_ids and filters by them with distinct count", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue(SOCIAL_IDS);
    const rows = mockRows({ data: [ROW], error: null });
    const count = mockCount({ count: 7, error: null });
    wire(rows, count);
    const result = await selectPosts({ artistAccountId: ARTIST_ID, page: 2, limit: 5 });
    expect(vi.mocked(selectAccountSocialIds)).toHaveBeenCalledWith(ARTIST_ID);
    expect(rows.in).toHaveBeenCalledWith(FILTER_COL, SOCIAL_IDS);
    expect(count.select).toHaveBeenCalledWith(expect.stringContaining(JOIN), {
      count: "exact",
      head: true,
    });
    expect(count.in).toHaveBeenCalledWith(FILTER_COL, SOCIAL_IDS);
    expect(rows.range).toHaveBeenCalledWith(5, 9);
    expect(result).toEqual({ posts: [CLEAN], totalCount: 7 });
    expect(result.posts[0]).not.toHaveProperty("social_posts");
  });

  it("short-circuits to empty result when artist has no socials", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue([]);
    const result = await selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 });
    expect(result).toEqual({ posts: [], totalCount: 0 });
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled();
  });

  it("throws when the rows query errors", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue(SOCIAL_IDS);
    wire(
      mockRows({ data: null, error: { message: "boom" } }),
      mockCount({ count: 0, error: null }),
    );
    await expect(selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 })).rejects.toThrow(
      /Failed to fetch posts/,
    );
  });
});
