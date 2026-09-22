import { expect, it, vi } from "vitest";
import { collectContextSongstats } from "../collectContextSongstats";
const input = {
  subjectId: "00000000-0000-4000-8000-000000000001",
  collectionVersion: "fixture-v1",
  lookup: { kind: "recording" as const, isrc: "US-AT2-21-03065" },
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
    fetcher: vi.fn(async () => ({
      status: 200,
      data: { links: [{ platform: "apple", url: "https://music.apple.com/example" }] },
    })),
  };
}
it("saves the unmodified aggregator response as a partial observation and source snapshot", async () => {
  const d = dependencies();
  await collectContextSongstats("actor", "owner", "request", input, d);
  expect(d.rpc).toHaveBeenCalledWith(
    "claim_context_enrichment",
    expect.objectContaining({
      p_module: expect.objectContaining({
        topic: "songstats_context",
        evidenceKind: "observation",
      }),
    }),
  );
  expect(d.rpc).toHaveBeenCalledWith(
    "complete_context_enrichment",
    expect.objectContaining({
      p_result: expect.objectContaining({
        coverage: "partial",
        costUsd: null,
        content: expect.objectContaining({ identityConfirmed: false, scope: "workspace_private" }),
        observedSources: [
          expect.objectContaining({
            content: expect.objectContaining({
              payload: {
                links: [{ platform: "apple", url: "https://music.apple.com/example" }],
              },
            }),
          }),
        ],
      }),
    }),
  );
  expect(d.fetcher).toHaveBeenCalledWith("/tracks/info", { isrc: "USAT22103065" });
});
it("reuses without another provider call and rejects unauthorized access before lookup", async () => {
  const d = dependencies();
  d.rpc.mockResolvedValue({ state: "reused" });
  await collectContextSongstats("actor", "owner", "request", input, d);
  expect(d.fetcher).not.toHaveBeenCalled();
  d.authorize.mockRejectedValue(new Error("denied"));
  await expect(collectContextSongstats("actor", "owner", "request", input, d)).rejects.toThrow(
    "denied",
  );
  expect(d.fetcher).not.toHaveBeenCalled();
});
it("does not save when access is revoked while the provider request is in flight", async () => {
  const d = dependencies();
  d.authorize.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("revoked"));
  await expect(collectContextSongstats("actor", "owner", "request", input, d)).rejects.toThrow(
    "revoked",
  );
  expect(d.rpc).toHaveBeenCalledWith("fail_context_enrichment", expect.anything());
  expect(d.rpc.mock.calls.some(([name]) => name === "complete_context_enrichment")).toBe(false);
});
