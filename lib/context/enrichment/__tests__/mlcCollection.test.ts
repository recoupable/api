import { expect, it, vi } from "vitest";
import { collectContextMlc } from "../collectContextMlc";
const base = { subjectId: "00000000-0000-4000-8000-000000000001", collectionVersion: "v1" };
function deps() {
  return {
    authorize: vi.fn(async () => undefined),
    resolveRecording: vi.fn(async () => "USAT22103065"),
    rpc: vi.fn(
      async (name: string): Promise<unknown> =>
        name === "claim_context_enrichment"
          ? { state: "claimed", attemptId: "a" }
          : { state: "saved" },
    ),
    getAccessToken: vi.fn(async () => "secret-token"),
    fetcher: vi.fn<typeof fetch>(async () =>
      Response.json({ mlcSongCode: "123", writers: [], publishers: [{ collectionShare: 50 }] }),
    ),
  };
}
it("saves work evidence and source snapshots without credentials or ownership claims", async () => {
  const d = deps();
  await collectContextMlc(
    "actor",
    "owner",
    "request",
    { ...base, operation: "work", workCode: "123" },
    d,
  );
  expect(d.rpc).toHaveBeenCalledWith(
    "complete_context_enrichment",
    expect.objectContaining({
      p_result: expect.objectContaining({
        coverage: "partial",
        content: expect.objectContaining({ ownershipVerified: false }),
        observedSources: [
          expect.objectContaining({
            kind: "provider_metadata",
            content: expect.objectContaining({ httpStatus: 200 }),
          }),
        ],
      }),
    }),
  );
  expect(JSON.stringify(d.rpc.mock.calls)).not.toContain("secret-token");
});
it("skips credentials and provider on reuse or authorization failure", async () => {
  const d = deps();
  d.rpc.mockResolvedValue({ state: "reused" });
  await collectContextMlc(
    "a",
    "o",
    "r",
    { ...base, operation: "recording", isrc: "USAT22103065" },
    d,
  );
  expect(d.getAccessToken).not.toHaveBeenCalled();
  expect(d.fetcher).not.toHaveBeenCalled();
  d.authorize.mockRejectedValueOnce(new Error("denied"));
  await expect(
    collectContextMlc("a", "o", "r", { ...base, operation: "work", workCode: "123" }, d),
  ).rejects.toThrow("denied");
  expect(d.getAccessToken).not.toHaveBeenCalled();
});
it("persists recording source gaps with unknown coverage and preserves search candidates", async () => {
  const d = deps();
  d.fetcher.mockResolvedValueOnce(Response.json([]));
  await collectContextMlc(
    "a",
    "o",
    "r",
    { ...base, operation: "recording", isrc: "US-AT2-21-03065" },
    d,
  );
  expect(d.rpc).toHaveBeenCalledWith(
    "complete_context_enrichment",
    expect.objectContaining({ p_result: expect.objectContaining({ coverage: "unknown" }) }),
  );
  d.fetcher.mockResolvedValueOnce(Response.json([{ mlcSongCode: "1" }, { mlcSongCode: "2" }]));
  await collectContextMlc("a", "o", "r", { ...base, operation: "search", title: "Song" }, d);
  expect(d.rpc).toHaveBeenCalledWith(
    "complete_context_enrichment",
    expect.objectContaining({
      p_result: expect.objectContaining({
        content: expect.objectContaining({ status: "needs_review", identityConfirmed: false }),
      }),
    }),
  );
});

it("rejects an ISRC belonging to another recording before reuse or credentials", async () => {
  const d = deps();
  d.resolveRecording.mockResolvedValue("USAT22199999");
  d.rpc.mockResolvedValue({ state: "reused" });
  await expect(
    collectContextMlc("a", "o", "r", { ...base, operation: "recording", isrc: "USAT22103065" }, d),
  ).rejects.toThrow("ISRC does not match");
  expect(d.rpc).not.toHaveBeenCalled();
  expect(d.getAccessToken).not.toHaveBeenCalled();
  expect(d.fetcher).not.toHaveBeenCalled();
});
it("refuses to complete recording evidence when request membership changes during lookup", async () => {
  const d = deps();
  d.fetcher.mockImplementation(async () => {
    d.resolveRecording.mockRejectedValue(new Error("Recording removed"));
    return Response.json([]);
  });
  await expect(
    collectContextMlc("a", "o", "r", { ...base, operation: "recording", isrc: "USAT22103065" }, d),
  ).rejects.toThrow("Recording removed");
  expect(d.rpc.mock.calls.some(([name]) => name === "complete_context_enrichment")).toBe(false);
  expect(d.rpc).toHaveBeenCalledWith("fail_context_enrichment", expect.anything());
});
it("saves a work projection with unknown territory and dates and no ownership claim", async () => {
  const d = deps();
  d.fetcher.mockResolvedValueOnce(
    Response.json({
      mlcSongCode: "123",
      primaryTitle: "Fixture Work",
      writers: [{ writerFirstName: "Ada", writerLastName: "Fixture", writerIPI: "00001234567" }],
      publishers: [{ publisherName: "Fixture Music", collectionShare: 50 }],
    }),
  );
  await collectContextMlc("a", "o", "r", { ...base, operation: "work", workCode: "123" }, d);
  const calls = d.rpc.mock.calls as unknown as Array<
    [string, { p_module: { key: string }; p_result: { content: Record<string, unknown> } }]
  >;
  // The saved content shape changed, so results saved before the projection are not reused.
  expect(calls.find(([name]) => name === "claim_context_enrichment")![1].p_module.key).toBe(
    "mlc-work-v2",
  );
  const content = calls.find(([name]) => name === "complete_context_enrichment")![1].p_result
    .content;
  expect(content.ownershipVerified).toBe(false);
  expect(content.projection).toMatchObject({
    claimKind: "registry_claim",
    ownershipVerified: false,
    status: "source_found",
    workIds: [{ provider: "mlc", songCode: "123", iswc: null, title: "Fixture Work" }],
    shares: [
      {
        record: { provider: "mlc", recordKind: "work", songCode: "123" },
        party: "Fixture Music",
        shareKind: "collection_share",
        percent: 50,
        territory: "unknown",
        effectiveFrom: null,
        effectiveTo: null,
        dateState: "unknown",
      },
    ],
    conflicts: [],
  });
  expect(JSON.stringify(content.projection)).not.toContain("secret-token");
});
