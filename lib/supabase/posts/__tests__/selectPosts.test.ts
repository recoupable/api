import { describe, it, expect, vi, beforeEach } from "vitest";
import supabase from "../../serverClient";
import { selectAccountSocialIds } from "../../account_socials/selectAccountSocialIds";
import { selectPosts } from "../selectPosts";

vi.mock("../../serverClient", () => ({ default: { from: vi.fn() } }));
vi.mock("../../account_socials/selectAccountSocialIds", () => ({
  selectAccountSocialIds: vi.fn(),
}));

const ARTIST_ID = "11111111-1111-4111-8111-111111111111";
const SOCIAL_IDS = ["s1", "s2"];
const POST = { id: "p1", post_url: "https://x.example/p/1", updated_at: "2026-04-20T00:00:00Z" };
const POST_WITH_EMBED = { ...POST, social_posts: [{ social_id: "s1" }] };
const FILTER_PATH = "social_posts.social_id";
const EMBED = "id, post_url, updated_at, social_posts!inner(social_id)";

type Result<T> = { data: T; error: { message: string } | null; count?: number };

function makeThenable<T>(result: Result<T>) {
  return { then: (fn: (r: Result<T>) => unknown) => fn(result) };
}

function mockChain(result: Result<(typeof POST_WITH_EMBED)[]>) {
  const range = vi.fn().mockReturnValue(makeThenable(result));
  const order = vi.fn().mockReturnValue({ range });
  const inFn = vi.fn().mockReturnValue({ order, range });
  const select = vi.fn().mockReturnValue({ in: inFn, order, range });
  return { select, in: inFn, order, range };
}

describe("selectPosts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("without artistAccountId: inner-joined embed, no .in() filter", async () => {
    const m = mockChain({ data: [POST_WITH_EMBED], error: null, count: 42 });
    vi.mocked(supabase.from).mockReturnValueOnce({ select: m.select } as never);

    const result = await selectPosts({ page: 2, limit: 5 });

    expect(supabase.from).toHaveBeenCalledWith("posts");
    expect(m.select).toHaveBeenCalledWith(EMBED, { count: "exact" });
    expect(m.in).not.toHaveBeenCalled();
    expect(m.order).toHaveBeenCalledWith("updated_at", { ascending: false, nullsFirst: false });
    expect(m.range).toHaveBeenCalledWith(5, 9);
    expect(result).toEqual({ posts: [POST], totalCount: 42 });
  });

  it("with artistAccountId: resolves socials and applies .in() filter", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue(SOCIAL_IDS);
    const m = mockChain({ data: [POST_WITH_EMBED], error: null, count: 7 });
    vi.mocked(supabase.from).mockReturnValueOnce({ select: m.select } as never);

    const result = await selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 });

    expect(selectAccountSocialIds).toHaveBeenCalledWith(ARTIST_ID);
    expect(m.select).toHaveBeenCalledWith(EMBED, { count: "exact" });
    expect(m.in).toHaveBeenCalledWith(FILTER_PATH, SOCIAL_IDS);
    expect(m.order).toHaveBeenCalledWith("updated_at", { ascending: false, nullsFirst: false });
    expect(m.range).toHaveBeenCalledWith(0, 9);
    expect(result).toEqual({ posts: [POST], totalCount: 7 });
  });

  it("passes empty socialIds through to .in() when the artist has none", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue([]);
    const m = mockChain({ data: [], error: null, count: 0 });
    vi.mocked(supabase.from).mockReturnValueOnce({ select: m.select } as never);

    const result = await selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 });

    expect(m.in).toHaveBeenCalledWith(FILTER_PATH, []);
    expect(result).toEqual({ posts: [], totalCount: 0 });
  });

  it("throws when the query errors", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue(SOCIAL_IDS);
    const m = mockChain({
      data: null as unknown as (typeof POST_WITH_EMBED)[],
      error: { message: "boom" },
    });
    vi.mocked(supabase.from).mockReturnValueOnce({ select: m.select } as never);

    await expect(selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 })).rejects.toThrow(
      /Failed to fetch posts/,
    );
  });
});
