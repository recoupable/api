import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectStoredPostComments } from "../selectStoredPostComments";
const { fetchFixture } = vi.hoisted(() => ({ fetchFixture: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    default: createClient("https://fixture.invalid", "dummy-fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchFixture },
    }),
  };
});
beforeEach(() => {
  vi.resetAllMocks();
});
describe("stored-comment PostgREST wire contract (HTTP stub only)", () => {
  it("serializes nested ownership, post narrowing, stable sort, range and exact count using the real SDK", async () => {
    fetchFixture.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "comment",
            post_id: "post",
            social_id: null,
            comment: "saved text",
            commented_at: "2026-10-10T00:00:00Z",
            posts: { social_posts: [{ social_id: "creator" }] },
          },
        ]),
        {
          status: 206,
          headers: { "content-type": "application/json", "content-range": "10-10/11" },
        },
      ),
    );
    const result = await selectStoredPostComments({
      socialIds: ["creator", "other-linked-social"],
      postId: "post",
      page: 2,
      limit: 10,
    });
    expect(fetchFixture).toHaveBeenCalledTimes(1);
    const [raw, options] = fetchFixture.mock.calls[0];
    const url = new URL(raw);
    expect(url.origin).toBe("https://fixture.invalid");
    expect(url.pathname).toBe("/rest/v1/post_comments");
    expect(url.searchParams.get("posts.social_posts.social_id")).toBe(
      "in.(creator,other-linked-social)",
    );
    expect(url.searchParams.get("post_id")).toBe("eq.post");
    expect(url.searchParams.has("social_id")).toBe(false);
    expect(url.searchParams.get("order")).toBe("commented_at.desc,id.desc");
    expect(url.searchParams.get("offset")).toBe("10");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("select")).toBe(
      "id,post_id,social_id,comment,commented_at,posts!inner(social_posts!inner(social_id))",
    );
    expect(new Headers(options.headers).get("prefer")).toContain("count=exact");
    expect(options.method).toBe("GET");
    expect(result.totalCount).toBe(11);
    expect(result.comments[0]).not.toHaveProperty("posts");
  });
  it("turns backend errors into failures rather than exposing an unscoped fallback", async () => {
    fetchFixture.mockResolvedValue(
      new Response(JSON.stringify({ message: "fixture storage unavailable" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      selectStoredPostComments({ socialIds: ["creator"], page: 1, limit: 10 }),
    ).rejects.toBeTruthy();
    expect(fetchFixture).toHaveBeenCalledTimes(1);
  });
});
