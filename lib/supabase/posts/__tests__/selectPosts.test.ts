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
const JOIN_FILTER_PATH = "social_posts.social_id";
const JOIN_EMBED = "id, post_url, updated_at, social_posts!inner(social_id)";

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
  const inFn = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ in: inFn });
  return { select, in: inFn, order, range };
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

  it("with artistAccountId: resolves socials then runs inner-joined posts query", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue(SOCIAL_IDS);
    const m = mockJoinedChain({ data: [POST_WITH_EMBED], error: null, count: 7 });
    vi.mocked(supabase.from).mockReturnValueOnce({ select: m.select } as never);

    const result = await selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 });

    expect(selectAccountSocialIds).toHaveBeenCalledWith(ARTIST_ID);
    expect(supabase.from).toHaveBeenCalledWith("posts");
    expect(m.select).toHaveBeenCalledWith(JOIN_EMBED, { count: "exact" });
    expect(m.in).toHaveBeenCalledWith(JOIN_FILTER_PATH, SOCIAL_IDS);
    expect(m.order).toHaveBeenCalledWith("updated_at", { ascending: false, nullsFirst: false });
    expect(m.range).toHaveBeenCalledWith(0, 9);
    expect(result).toEqual({ posts: [POST], totalCount: 7 });
  });

  it("short-circuits when the artist has no linked socials", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue([]);

    const result = await selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 });

    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toEqual({ posts: [], totalCount: 0 });
  });

  it("throws when the joined query errors", async () => {
    vi.mocked(selectAccountSocialIds).mockResolvedValue(SOCIAL_IDS);
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
