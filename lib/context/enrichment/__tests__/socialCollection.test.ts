import { expect, it, vi } from "vitest";
import { collectContextSocialEvidence } from "../collectContextSocialEvidence";
import { collectContextSocials } from "../../providers/collectContextSocials";
const id = "00000000-0000-4000-8000-000000000001";
function deps() {
  return {
    authorize: vi.fn(async () => {}),
    rpc: vi.fn(
      async (name: string): Promise<unknown> =>
        name === "resolve_context_artist"
          ? { artistId: id }
          : name === "claim_context_enrichment"
            ? { state: "claimed", attemptId: "a" }
            : { state: "saved" },
    ),
    collect: vi.fn(async (a: string, b: string, page = 1) =>
      collectContextSocials(a, b, page, {
        access: async () => true,
        profiles: async () => [],
        posts: async () => ({ posts: [post], totalCount: 120 }),
        media: async () => [mediaRow],
      }),
    ),
  };
}
const post = {
  id: "p1",
  post_url: "https://www.instagram.com/p/1",
  updated_at: "2026-08-20T00:00:00+00:00",
  views: null,
  likes: 1,
  comments: 0,
  reposts: null,
};
const mediaRow = {
  id: "p1",
  caption: "studio week two",
  published_at: "2026-08-20T00:00:00+00:00",
  media: [
    {
      position: 0,
      kind: "image",
      provider_url: "https://cdn.example/1.jpg",
      width: 1080,
      height: 1350,
      alt: null,
      source: "apify_instagram",
    },
  ],
  media_observed_at: "2026-10-10T12:00:00+00:00",
};
it("retains pages together and explicitly limits collection", async () => {
  const d = deps();
  await collectContextSocialEvidence(
    id,
    id,
    "request",
    { subjectId: id, collectionVersion: "v1", maxPages: 2 },
    d,
  );
  expect(d.collect).toHaveBeenCalledTimes(2);
  expect(d.rpc).toHaveBeenCalledWith(
    "complete_context_enrichment",
    expect.objectContaining({
      p_result: expect.objectContaining({
        coverage: "partial",
        content: expect.objectContaining({
          pages: expect.any(Array),
          truncated: true,
          nextPage: 3,
          scope: "workspace_private",
        }),
      }),
    }),
  );
});
it("saves retained captions and media as reference-only provider references, never bytes", async () => {
  const d = deps();
  await collectContextSocialEvidence(
    id,
    id,
    "request",
    { subjectId: id, collectionVersion: "v1", maxPages: 1 },
    d,
  );
  const call = d.rpc.mock.calls.find(c => c[0] === "complete_context_enrichment");
  type Saved = { p_result: { content: { pages: { posts: unknown[] }[] } } };
  const [, args] = call as unknown as [string, Saved];
  const result = args.p_result;
  const saved = result.content.pages[0].posts[0];
  expect(saved).toMatchObject({
    id: "p1",
    caption: "studio week two",
    published_at: "2026-08-20T00:00:00+00:00",
    media: [expect.objectContaining({ provider_url: "https://cdn.example/1.jpg", kind: "image" })],
    usage_status: "reference_only",
    retained_bytes: null,
    provider_url_status: "may_expire",
  });
  const serialized = JSON.stringify(result);
  expect(serialized).not.toContain("base64");
  expect(serialized).not.toContain("not returned by this stored-metrics query");
  expect(serialized).toContain("no bytes retained");
});
it("checks workspace before reuse and makes no social read", async () => {
  const d = deps();
  d.rpc.mockImplementation(async name =>
    name === "resolve_context_artist" ? { artistId: id } : { state: "reused" },
  );
  await collectContextSocialEvidence(id, id, "r", { subjectId: id, collectionVersion: "v1" }, d);
  expect(d.collect).not.toHaveBeenCalled();
});
it("stops saving after artist access is revoked", async () => {
  const d = deps();
  let calls = 0;
  d.rpc.mockImplementation(async name => {
    if (name === "resolve_context_artist") {
      if (++calls === 3) throw Error("revoked");
      return { artistId: id };
    }
    return { state: "claimed", attemptId: "a" };
  });
  await expect(
    collectContextSocialEvidence(
      id,
      id,
      "r",
      { subjectId: id, collectionVersion: "v1", maxPages: 1 },
      d,
    ),
  ).rejects.toThrow("revoked");
  expect(d.rpc.mock.calls.map(c => c[0])).not.toContain("complete_context_enrichment");
});
