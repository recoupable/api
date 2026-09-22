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
        posts: async () => ({ posts: [], totalCount: 120 }),
      }),
    ),
  };
}
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
