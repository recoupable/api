import { expect, it, vi } from "vitest";
import { readReleaseTrackObservations } from "../readReleaseTrackObservations";

const owner = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const subjectId = "33333333-3333-4333-8333-333333333333";
const releaseSourceResultId = "44444444-4444-4444-8444-444444444444";
const resultId = "55555555-5555-4555-8555-555555555555";
const versionId = "66666666-6666-4666-8666-666666666666";
const trackId = "AAAAAAAAAAAAAAAAAAAAAA";
const page = { state: "ready", sourceResultId: releaseSourceResultId, linkedSlots: 1 };
const content = {
  releaseSourceResultId,
  slots: [{ slotIndex: 0, spotifyTrackId: trackId, state: "observed", isrc: "USABC2600001" }],
  observations: [
    {
      spotifyTrackId: trackId,
      state: "observed",
      isrc: "USABC2600001",
      sourceUrl: `https://api.spotify.com/v1/tracks/${trackId}`,
      retrievedAt: "2026-09-24T12:00:00Z",
      elapsedMs: 12,
      httpStatus: 200,
      gap: null,
    },
  ],
  observedIsrcCount: 1,
  missingIsrcCount: 0,
  failedLookupCount: 0,
  coverage: "full",
};
const document = {
  subjectId,
  topic: "spotify_release_track_isrcs",
  resultId,
  text: JSON.stringify(content),
  sources: [
    {
      versionId,
      url: `https://api.spotify.com/v1/tracks/${trackId}`,
      retrievedAt: "2026-09-24T12:00:00Z",
    },
  ],
};

it("returns only current request-bound observations and source links", async () => {
  const rpc = vi.fn(async (name: string) =>
    name === "list_context_release_track_slots" ? page : [document],
  );
  const result = await readReleaseTrackObservations(owner, requestId, subjectId, rpc);
  expect(result).toMatchObject({
    state: "ready",
    resultId,
    releaseSourceResultId,
    observedIsrcCount: 1,
    sources: [{ versionId }],
    observations: [{ spotifyTrackId: trackId }],
  });
  expect(rpc).toHaveBeenCalledWith("read_context_documents", {
    p_owner: owner,
    p_request: requestId,
  });
  expect(rpc).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(result)).not.toContain("raw");
});

it("does not show an observation from a different release result", async () => {
  const rpc = vi.fn(async (name: string) =>
    name === "list_context_release_track_slots"
      ? page
      : [
          {
            ...document,
            text: JSON.stringify({
              ...content,
              releaseSourceResultId: "77777777-7777-4777-8777-777777777777",
            }),
          },
        ],
  );
  await expect(
    readReleaseTrackObservations(owner, requestId, subjectId, rpc),
  ).resolves.toMatchObject({ state: "needs_reconciliation" });
});

it("shows withdrawn or absent evidence as uncollected", async () => {
  const rpc = vi.fn(async (name: string) =>
    name === "list_context_release_track_slots" ? page : [],
  );
  await expect(
    readReleaseTrackObservations(owner, requestId, subjectId, rpc),
  ).resolves.toMatchObject({ state: "not_collected" });
});

it("rejects a release change during the final source recheck", async () => {
  let pages = 0;
  const rpc = vi.fn(async (name: string) =>
    name === "read_context_documents"
      ? [document]
      : ++pages === 1
        ? page
        : { ...page, sourceResultId: "88888888-8888-4888-8888-888888888888" },
  );
  await expect(
    readReleaseTrackObservations(owner, requestId, subjectId, rpc),
  ).resolves.toMatchObject({ state: "needs_reconciliation" });
});
