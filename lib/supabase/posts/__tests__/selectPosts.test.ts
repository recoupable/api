import { describe, it, expect, vi, beforeEach } from "vitest";
import supabase from "../../serverClient";
import { selectPosts } from "../selectPosts";

vi.mock("../../serverClient", () => ({ default: { from: vi.fn() } }));

const ARTIST_ID = "11111111-1111-4111-8111-111111111111";
const POST = { id: "p1", post_url: "https://x.example/p/1", updated_at: "2026-04-20T00:00:00Z" };
const POST_WITH_EMBED = { ...POST, social_posts: [{ socials: [{ account_socials: [] }] }] };
const FILTER_PATH = "social_posts.socials.account_socials.account_id";
const EMBED =
  "id, post_url, updated_at, social_posts!inner(socials!inner(account_socials!inner(account_id)))";

type Result<T> = { data: T; error: { message: string } | null; count?: number };

function makeThenable<T>(result: Result<T>) {
  return { then: (fn: (r: Result<T>) => unknown) => fn(result) };
}

function mockNoFilterChain(result: Result<(typeof POST)[]>) {
  const range = vi.fn().mockReturnValue(makeThenable(result));
  const order = vi.fn().mockReturnValue({ range });
  const select = vi.fn().mockReturnValue({ order });
  return { select, order, range };
}

function mockJoinedChain(result: Result<(typeof POST_WITH_EMBED)[]>) {
  const range = vi.fn().mockReturnValue(makeThenable(result));
  const order = vi.fn().mockReturnValue({ range });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, order, range };
}

describe("selectPosts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("without artistAccountId: single count:exact query on posts with pagination", async () => {
    const m = mockNoFilterChain({ data: [POST], error: null, count: 42 });
    vi.mocked(supabase.from).mockReturnValueOnce({ select: m.select } as never);

    const result = await selectPosts({ page: 2, limit: 5 });

    expect(supabase.from).toHaveBeenCalledWith("posts");
    expect(m.select).toHaveBeenCalledWith("id, post_url, updated_at", { count: "exact" });
    expect(m.order).toHaveBeenCalledWith("updated_at", { ascending: false, nullsFirst: false });
    expect(m.range).toHaveBeenCalledWith(5, 9);
    expect(result).toEqual({ posts: [POST], totalCount: 42 });
  });

  it("with artistAccountId: single inner-joined embed query with filter path", async () => {
    const m = mockJoinedChain({ data: [POST_WITH_EMBED], error: null, count: 7 });
    vi.mocked(supabase.from).mockReturnValueOnce({ select: m.select } as never);

    const result = await selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 });

    expect(supabase.from).toHaveBeenCalledWith("posts");
    expect(m.select).toHaveBeenCalledWith(EMBED, { count: "exact" });
    expect(m.eq).toHaveBeenCalledWith(FILTER_PATH, ARTIST_ID);
    expect(m.order).toHaveBeenCalledWith("updated_at", { ascending: false, nullsFirst: false });
    expect(m.range).toHaveBeenCalledWith(0, 9);
    expect(result).toEqual({ posts: [POST], totalCount: 7 });
  });

  it("throws when the joined query errors", async () => {
    const m = mockJoinedChain({
      data: null as unknown as (typeof POST_WITH_EMBED)[],
      error: { message: "boom" },
    });
    vi.mocked(supabase.from).mockReturnValueOnce({ select: m.select } as never);

    await expect(selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 })).rejects.toThrow(
      /Failed to fetch posts/,
    );
  });
});
