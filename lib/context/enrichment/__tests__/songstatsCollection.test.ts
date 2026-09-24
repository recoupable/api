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
        name === "resolve_context_songstats_lookup"
          ? { kind: "recording", isrc: "USAT22103065" }
          : name === "claim_context_enrichment"
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
  d.rpc.mockImplementation(async (name: string) =>
    name === "resolve_context_songstats_lookup"
      ? { kind: "recording", isrc: "USAT22103065" }
      : { state: "reused" },
  );
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
  d.authorize
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("revoked"));
  await expect(collectContextSongstats("actor", "owner", "request", input, d)).rejects.toThrow(
    "revoked",
  );
  expect(d.rpc).toHaveBeenCalledWith("fail_context_enrichment", expect.anything());
  expect(d.rpc.mock.calls.some(([name]) => name === "complete_context_enrichment")).toBe(false);
});
it("rejects an identifier that belongs to another subject before claim or provider call", async () => {
  const d = dependencies();
  d.rpc.mockImplementation(async (name: string) =>
    name === "resolve_context_songstats_lookup"
      ? { kind: "recording", isrc: "GBABC1234567" }
      : { state: "claimed", attemptId: "attempt" },
  );
  await expect(collectContextSongstats("actor", "owner", "request", input, d)).rejects.toThrow(
    "identifier does not match",
  );
  expect(d.rpc.mock.calls.some(([name]) => name === "claim_context_enrichment")).toBe(false);
  expect(d.fetcher).not.toHaveBeenCalled();
});
it.each([
  { kind: "recording" as const, spotifyId: "2zpWJxfuyxqCYhpsAqH7Uh" },
  { kind: "artist" as const, spotifyId: "1QzqrU2lmiW9l1mSvliVoM" },
])("rejects a wrong Spotify ID for a $kind subject", async lookup => {
  const d = dependencies();
  d.rpc.mockImplementation(async (name: string) =>
    name === "resolve_context_songstats_lookup"
      ? { kind: lookup.kind, spotifyId: "6pPY9v1Bk7ppYcyDgc94Bf" }
      : { state: "claimed", attemptId: "attempt" },
  );
  await expect(
    collectContextSongstats("actor", "owner", "request", { ...input, lookup }, d),
  ).rejects.toThrow("identifier does not match");
  expect(d.rpc.mock.calls.some(([name]) => name === "claim_context_enrichment")).toBe(false);
});
it("rechecks the identifier after provider response before saving", async () => {
  const d = dependencies();
  let lookups = 0;
  d.rpc.mockImplementation(async (name: string) => {
    if (name === "resolve_context_songstats_lookup")
      return { kind: "recording", isrc: ++lookups === 3 ? "GBABC1234567" : "USAT22103065" };
    if (name === "claim_context_enrichment") return { state: "claimed", attemptId: "attempt" };
    return { state: "saved" };
  });
  await expect(collectContextSongstats("actor", "owner", "request", input, d)).rejects.toThrow(
    "identifier does not match",
  );
  expect(d.fetcher).toHaveBeenCalledTimes(1);
  expect(d.rpc.mock.calls.some(([name]) => name === "complete_context_enrichment")).toBe(false);
});
