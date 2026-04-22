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
const POST = { id: "p1", post_url: "https://x.example/p/1", updated_at: "2026-04-20T00:00:00Z" };

type Result<T> = { data: T; error: { message: string } | null; count?: number };

function makeThenable<T>(result: Result<T>) {
  return { then: (fn: (r: Result<T>) => unknown) => fn(result) };
}

function mockNoFilterPosts(result: Result<(typeof POST)[]>) {
  const range = vi.fn().mockReturnValue(makeThenable(result));
  const order = vi.fn().mockReturnValue({ range });
  const select = vi.fn().mockReturnValue({ order });
  return { select, order, range };
}

function mockSocialPosts(result: Result<Array<{ post_id: string; updated_at: string }>>) {
  const order = vi.fn().mockReturnValue(makeThenable(result));
  const inFn = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ in: inFn });
  return { select, in: inFn, order };
}

function mockPostsByIds(result: Result<(typeof POST)[]>) {
  const order = vi.fn().mockReturnValue(makeThenable(result));
  const inFn = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ in: inFn });
  return { select, in: inFn, order };
}

describe("selectPosts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("without artistAccountId: single count:exact query with pagination", async () => {
    const m = mockNoFilterPosts({ data: [POST], error: null, count: 42 });
    vi.mocked(supabase.from).mockReturnValueOnce({ select: m.select } as never);

    const result = await selectPosts({ page: 2, limit: 5 });

    expect(supabase.from).toHaveBeenCalledWith("posts");
    expect(m.select).toHaveBeenCalledWith("id, post_url, updated_at", { count: "exact" });
    expect(m.order).toHaveBeenCalledWith("updated_at", { ascending: false, nullsFirst: false });
    expect(m.range).toHaveBeenCalledWith(5, 9);
    expect(result).toEqual({ posts: [POST], totalCount: 42 });
    expect(vi.mocked(selectAccountSocialIds)).not.toHaveBeenCalled();
  });

  it("with artistAccountId: resolves socials, fetches social_posts then posts by id", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue(SOCIAL_IDS);
    const sp = mockSocialPosts({
      data: [
        { post_id: "p1", updated_at: "2026-04-20T00:00:00Z" },
        { post_id: "p2", updated_at: "2026-04-19T00:00:00Z" },
        { post_id: "p1", updated_at: "2026-04-18T00:00:00Z" }, // dup, deduped
      ],
      error: null,
    });
    const posts = mockPostsByIds({ data: [POST], error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce({ select: sp.select } as never)
      .mockReturnValueOnce({ select: posts.select } as never);

    const result = await selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 });

    expect(vi.mocked(selectAccountSocialIds)).toHaveBeenCalledWith(ARTIST_ID);
    expect(sp.select).toHaveBeenCalledWith("post_id, updated_at");
    expect(sp.in).toHaveBeenCalledWith("social_id", SOCIAL_IDS);
    expect(posts.select).toHaveBeenCalledWith("id, post_url, updated_at");
    expect(posts.in).toHaveBeenCalledWith("id", ["p1", "p2"]);
    expect(result).toEqual({ posts: [POST], totalCount: 2 });
  });

  it("short-circuits to empty when artist has no socials", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue([]);
    const result = await selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 });
    expect(result).toEqual({ posts: [], totalCount: 0 });
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled();
  });

  it("short-circuits when socials have no posts", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue(SOCIAL_IDS);
    const sp = mockSocialPosts({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValueOnce({ select: sp.select } as never);

    const result = await selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 });
    expect(result).toEqual({ posts: [], totalCount: 0 });
  });

  it("throws when posts query errors", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue(SOCIAL_IDS);
    const sp = mockSocialPosts({
      data: [{ post_id: "p1", updated_at: "t" }],
      error: null,
    });
    const posts = mockPostsByIds({
      data: null as unknown as (typeof POST)[],
      error: { message: "boom" },
    });

    vi.mocked(supabase.from)
      .mockReturnValueOnce({ select: sp.select } as never)
      .mockReturnValueOnce({ select: posts.select } as never);

    await expect(selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 })).rejects.toThrow(
      /Failed to fetch posts/,
    );
  });
});
