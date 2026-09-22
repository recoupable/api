import { expect, it, vi } from "vitest";
import { collectContextSpotifyRelease } from "../collectContextSpotifyRelease";
const input = {
  subjectId: "00000000-0000-4000-8000-000000000001",
  releaseId: "3vX9jU6Ix8t7XsAWLoZs10",
  collectionVersion: "fixture-v1",
};
const album = {
  id: input.releaseId,
  name: "Fixture release",
  tracks: { items: [], total: 0, offset: 0, next: null },
};
function deps() {
  return {
    authorize: vi.fn(async () => undefined),
    getAccessToken: vi.fn(async () => "fixture-secret"),
    fetcher: vi.fn<typeof fetch>(async () => Response.json(album)),
    rpc: vi.fn(
      async (name: string): Promise<unknown> =>
        name === "claim_context_enrichment"
          ? { state: "claimed", attemptId: "attempt" }
          : { state: "saved" },
    ),
  };
}
it("saves raw album pages as a partial observation, never as rights evidence", async () => {
  const d = deps();
  await collectContextSpotifyRelease("actor", "owner", "request", input, d);
  expect(d.rpc).toHaveBeenCalledWith(
    "claim_context_enrichment",
    expect.objectContaining({
      p_module: expect.objectContaining({
        topic: "spotify_release_context",
        evidenceKind: "observation",
      }),
    }),
  );
  expect(d.rpc).toHaveBeenCalledWith(
    "complete_context_enrichment",
    expect.objectContaining({
      p_result: expect.objectContaining({
        coverage: "partial",
        content: expect.objectContaining({ ownershipVerified: false, scope: "workspace_private" }),
        observedSources: [
          expect.objectContaining({
            content: { pages: [expect.objectContaining({ payload: album })] },
          }),
        ],
      }),
    }),
  );
  expect(JSON.stringify(d.rpc.mock.calls)).not.toContain("fixture-secret");
});
it("reuses without a token and blocks unauthorized token acquisition", async () => {
  const d = deps();
  d.rpc.mockResolvedValue({ state: "reused" });
  await collectContextSpotifyRelease("actor", "owner", "request", input, d);
  expect(d.getAccessToken).not.toHaveBeenCalled();
  d.authorize.mockRejectedValueOnce(new Error("denied"));
  await expect(collectContextSpotifyRelease("actor", "owner", "request", input, d)).rejects.toThrow(
    "denied",
  );
  expect(d.getAccessToken).not.toHaveBeenCalled();
});
it("persists incomplete pagination with its actual provider failure status", async () => {
  const d = deps();
  d.fetcher
    .mockResolvedValueOnce(
      Response.json({
        ...album,
        tracks: {
          items: [{ name: "track" }],
          total: 2,
          offset: 0,
          next: `https://api.spotify.com/v1/albums/${input.releaseId}/tracks?offset=1`,
        },
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 429 }));
  await collectContextSpotifyRelease("actor", "owner", "request", input, d);
  expect(d.rpc).toHaveBeenCalledWith(
    "complete_context_enrichment",
    expect.objectContaining({
      p_result: expect.objectContaining({
        content: expect.objectContaining({
          trackCoverage: expect.objectContaining({ extent: "partial", collectedSlots: 1 }),
          snapshots: expect.arrayContaining([expect.objectContaining({ httpStatus: 429 })]),
        }),
      }),
    }),
  );
  expect(d.fetcher).toHaveBeenCalledTimes(2);
});
