import { describe, it, expect, vi, beforeEach } from "vitest";
import supabase from "../../serverClient";
import { selectPosts } from "../selectPosts";

vi.mock("../../serverClient", () => ({ default: { from: vi.fn() } }));

const ARTIST_ID = "11111111-1111-4111-8111-111111111111";
const ROW = { id: "p1", post_url: "https://x.example/p/1", updated_at: "t", social_posts: [{}] };
const CLEAN = { id: "p1", post_url: "https://x.example/p/1", updated_at: "t" };
const ARTIST_COL = "social_posts.socials.account_socials.account_id";
const JOIN_CHAIN = "social_posts!inner(socials!inner(account_socials!inner(account_id)))";

function mockRows(result: { data: unknown; error: { message: string } | null }) {
  const thenable = { then: (fn: (r: typeof result) => unknown) => fn(result) };
  const eq = vi.fn();
  eq.mockReturnValue({ eq, ...thenable });
  const range = vi.fn().mockReturnValue({ eq, ...thenable });
  const order = vi.fn().mockReturnValue({ range });
  const select = vi.fn().mockReturnValue({ order });
  return { select, eq, range, order };
}

function mockCount(result: { count: number; error: { message: string } | null }) {
  const thenable = { then: (fn: (r: typeof result) => unknown) => fn(result) };
  const eq = vi.fn();
  eq.mockReturnValue({ eq, ...thenable });
  const select = vi.fn().mockReturnValue({ eq, ...thenable });
  return { select, eq };
}

function wire(rows: ReturnType<typeof mockRows>, count: ReturnType<typeof mockCount>) {
  vi.mocked(supabase.from)
    .mockReturnValueOnce({ select: rows.select } as never)
    .mockReturnValueOnce({ select: count.select } as never);
}

describe("selectPosts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries with join chain and no filter when artistAccountId is absent", async () => {
    const rows = mockRows({ data: [ROW], error: null });
    const count = mockCount({ count: 3, error: null });
    wire(rows, count);
    const result = await selectPosts({ page: 1, limit: 10 });
    expect(rows.select).toHaveBeenCalledWith(expect.stringContaining(JOIN_CHAIN));
    expect(rows.order).toHaveBeenCalledWith("updated_at", { ascending: false, nullsFirst: false });
    expect(rows.range).toHaveBeenCalledWith(0, 9);
    expect(rows.eq).not.toHaveBeenCalled();
    expect(count.eq).not.toHaveBeenCalled();
    expect(result).toEqual({ posts: [CLEAN], totalCount: 3 });
    expect(result.posts[0]).not.toHaveProperty("social_posts");
  });

  it("applies artistAccountId filter with join chain and distinct count", async () => {
    const rows = mockRows({ data: [ROW], error: null });
    const count = mockCount({ count: 7, error: null });
    wire(rows, count);
    const result = await selectPosts({ artistAccountId: ARTIST_ID, page: 2, limit: 5 });
    expect(rows.select).toHaveBeenCalledWith(expect.stringContaining(JOIN_CHAIN));
    expect(rows.eq).toHaveBeenCalledWith(ARTIST_COL, ARTIST_ID);
    expect(count.select).toHaveBeenCalledWith(expect.stringContaining(JOIN_CHAIN), {
      count: "exact",
      head: true,
    });
    expect(count.eq).toHaveBeenCalledWith(ARTIST_COL, ARTIST_ID);
    expect(rows.range).toHaveBeenCalledWith(5, 9);
    expect(result).toEqual({ posts: [CLEAN], totalCount: 7 });
    expect(result.posts[0]).not.toHaveProperty("social_posts");
  });

  it("throws when the rows query errors", async () => {
    wire(
      mockRows({ data: null, error: { message: "boom" } }),
      mockCount({ count: 0, error: null }),
    );
    await expect(selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 })).rejects.toThrow(
      /Failed to fetch posts/,
    );
  });
});
