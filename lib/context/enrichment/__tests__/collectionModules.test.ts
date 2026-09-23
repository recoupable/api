import { expect, it, vi } from "vitest";
import { collectContextArtwork } from "../collectContextArtwork";
import { collectContextArtistResearch } from "../collectContextArtistResearch";
import { collectContextSongSummary } from "../collectContextSongSummary";
import { discoverContextArtistSources } from "../discoverContextArtistSources";
function dependencies(content: unknown, reused = false) {
  return {
    authorize: vi.fn(async () => true),
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) =>
      name === "claim_context_enrichment"
        ? { state: reused ? "reused" : "claimed", attemptId: "attempt" }
        : args,
    ),
    generate: vi.fn(async () => ({
      content,
      coverage: "partial" as const,
      costUsd: null,
      costStatus: "unknown" as const,
      trace: {},
    })),
  };
}
it("reuses artwork without another provider call", async () => {
  const deps = dependencies({}, true);
  await collectContextArtwork(
    "a",
    "o",
    "r",
    {
      releaseSubjectId: "release",
      artworkUrl: "https://example.com/cover.png",
      assetVersion: "v1",
    },
    deps,
  );
  expect(deps.generate).not.toHaveBeenCalled();
});
it("rejects unsupported research citations before completion", async () => {
  const deps = dependencies({
    artist: "Artist",
    claims: [{ claim: "Claim", sourceUrl: "https://invented.example", date: null }],
    identityCautions: [],
    missingContext: [],
  });
  await expect(
    collectContextArtistResearch(
      "a",
      "o",
      "r",
      {
        artistSubjectId: "artist",
        artistName: "Artist",
        spotifyId: "1QzqrU2lmiW9l1mSvliVoM",
        sources: [{ url: "https://example.com", title: "Source", snippet: "Evidence" }],
      },
      deps,
    ),
  ).rejects.toThrow("Unsupported research citation");
  expect(deps.rpc.mock.calls.some(([name]) => name === "complete_context_enrichment")).toBe(false);
  expect(deps.rpc.mock.calls.some(([name]) => name === "fail_context_enrichment")).toBe(true);
});
it("blocks mismatched summary evidence before a paid claim", async () => {
  const deps = dependencies({});
  await expect(
    collectContextSongSummary(
      "a",
      "o",
      "r",
      {
        recordingSubjectId: "one",
        audio: { recordingSubjectId: "other", resultId: "result", coverage: "full", content: {} },
        lyrics: null,
        lyricGap: "Unavailable",
      },
      deps,
    ),
  ).rejects.toThrow("different recording");
  expect(deps.rpc).not.toHaveBeenCalled();
});
it("saves partial coverage for a music-only summary", async () => {
  const deps = dependencies({ summary: "Music only" });
  await collectContextSongSummary(
    "a",
    "o",
    "r",
    {
      recordingSubjectId: "one",
      audio: { recordingSubjectId: "one", resultId: "result", coverage: "full", content: {} },
      lyrics: null,
      lyricGap: "Unavailable",
    },
    deps,
  );
  const claimed = deps.rpc.mock.calls.find(([name]) => name === "claim_context_enrichment");
  expect(claimed?.[1].p_module).toMatchObject({
    sources: [
      {
        url: "urn:recoup:context-result:result",
        kind: "provider_metadata",
        content: { resultId: "result", coverage: "full" },
      },
    ],
  });
  const completed = deps.rpc.mock.calls.find(([name]) => name === "complete_context_enrichment");
  expect(completed?.[1].p_result).toMatchObject({ coverage: "partial", costUsd: null });
});
it("builds discovery queries from the actual artist without claiming verified facts", async () => {
  const search = vi.fn(async () => ({ id: "search", results: [] }));
  const result = await discoverContextArtistSources(
    {
      artistName: "Another artist",
      spotifyId: "1QzqrU2lmiW9l1mSvliVoM",
      releaseTitle: "New release",
    },
    search,
  );
  expect(search.mock.calls[0]).toBeDefined();
  expect(result.trace.query.query).toContain("Another artist");
  expect(result.costUsd).toBeNull();
});
