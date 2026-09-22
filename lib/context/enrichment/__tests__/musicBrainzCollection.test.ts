import { expect, it, vi } from "vitest";
import { collectContextMusicBrainz } from "../collectContextMusicBrainz";
const input = {
  recordingSubjectId: "00000000-0000-4000-8000-000000000001",
  isrc: "US-AT2-21-03065",
  collectionVersion: "2026-09-22",
};
function dependencies() {
  return {
    authorize: vi.fn(async () => undefined),
    rpc: vi.fn(
      async (name: string): Promise<unknown> =>
        name === "claim_context_enrichment"
          ? { state: "claimed", attemptId: "attempt" }
          : { state: "saved" },
    ),
    acquirePermit: vi.fn(async () => undefined),
    fetcher: vi.fn<typeof fetch>(async () => new Response(null, { status: 404 })),
  };
}
it("persists a no-match observation with unknown coverage and exact source response status", async () => {
  const d = dependencies();
  await collectContextMusicBrainz("actor", "owner", "request", input, d);
  expect(d.rpc).toHaveBeenCalledWith(
    "claim_context_enrichment",
    expect.objectContaining({
      p_module: expect.objectContaining({
        topic: "musicbrainz_recordings",
        evidenceKind: "observation",
        input: expect.objectContaining({ isrc: "USAT22103065" }),
      }),
    }),
  );
  expect(d.rpc).toHaveBeenCalledWith(
    "complete_context_enrichment",
    expect.objectContaining({
      p_result: expect.objectContaining({
        coverage: "unknown",
        content: expect.objectContaining({ status: "not_found" }),
        trace: expect.objectContaining({ httpStatus: 404 }),
        observedSources: [
          expect.objectContaining({
            kind: "provider_metadata",
            content: expect.objectContaining({ httpStatus: 404 }),
          }),
        ],
      }),
    }),
  );
  expect(d.acquirePermit).toHaveBeenCalledOnce();
});
it("reuses without provider access and isolates collection versions in the fingerprint", async () => {
  const d = dependencies();
  d.rpc.mockResolvedValue({ state: "reused" });
  await collectContextMusicBrainz("actor", "owner", "request", input, d);
  await collectContextMusicBrainz(
    "actor",
    "owner",
    "request",
    { ...input, collectionVersion: "2026-09-23" },
    d,
  );
  expect(d.fetcher).not.toHaveBeenCalled();
  expect(d.acquirePermit).not.toHaveBeenCalled();
  const calls = d.rpc.mock.calls as unknown as Array<
    [string, { p_module: { fingerprint: string } }]
  >;
  expect(calls[0][1].p_module.fingerprint).not.toBe(calls[1][1].p_module.fingerprint);
});
it("preserves ambiguous candidates as partial and prevents calls when access is denied", async () => {
  const d = dependencies();
  d.authorize.mockRejectedValueOnce(new Error("denied"));
  await expect(collectContextMusicBrainz("actor", "owner", "request", input, d)).rejects.toThrow(
    "denied",
  );
  expect(d.fetcher).not.toHaveBeenCalled();
  d.fetcher.mockResolvedValue(
    Response.json({
      isrc: "USAT22103065",
      recordings: [
        { id: "a", title: "Song" },
        { id: "b", title: "Other" },
      ],
    }),
  );
  await collectContextMusicBrainz("actor", "owner", "request", input, d);
  expect(d.rpc).toHaveBeenCalledWith(
    "complete_context_enrichment",
    expect.objectContaining({
      p_result: expect.objectContaining({
        coverage: "partial",
        content: expect.objectContaining({ status: "needs_review" }),
      }),
    }),
  );
});
