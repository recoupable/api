import { afterEach, expect, it, vi } from "vitest";
import { runReleaseTrackIsrcs } from "../runReleaseTrackIsrcs";

vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));

const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const subjectId = "44444444-4444-4444-8444-444444444444";
const sourceResultId = "55555555-5555-4555-8555-555555555555";
const attemptId = "66666666-6666-4666-8666-666666666666";
const resultId = "77777777-7777-4777-8777-777777777777";
const trackId = "AAAAAAAAAAAAAAAAAAAAAA";
const page = {
  state: "ready",
  releaseId: "BBBBBBBBBBBBBBBBBBBBBB",
  sourceResultId,
  coverage: "full",
  collectedSlots: 1,
  reportedTotal: 1,
  linkedSlots: 1,
  unavailableSlots: 0,
  hasMore: false,
  nextCursor: null,
  slots: [{ slotIndex: 0, spotifyTrackId: trackId, discNumber: 1, trackNumber: 1, sourceResultId }],
};
const authorize = vi.fn(async () => ({ ownerId: owner }));
afterEach(() => {
  delete process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED;
  vi.clearAllMocks();
});

it("keeps the provider and claim off unless explicitly enabled", async () => {
  const rpc = vi.fn();
  const fetcher = vi.fn();
  await expect(
    runReleaseTrackIsrcs(actor, owner, requestId, subjectId, {
      authorize,
      rpc,
      fetcher,
    }),
  ).rejects.toThrow("not enabled");
  expect(rpc).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});

it("claims current album positions once and saves the exact provider response", async () => {
  process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED = "true";
  const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
    if (name === "list_context_release_track_slots") return page;
    if (name === "claim_context_release_track_isrcs") return { state: "claimed", attemptId };
    if (name === "complete_context_release_track_isrcs") {
      expect(params).toMatchObject({
        p_owner: owner,
        p_request: requestId,
        p_subject: subjectId,
        p_release_result: sourceResultId,
        p_attempt: attemptId,
      });
      expect(params.p_payload).toMatchObject({
        observations: [
          {
            spotifyTrackId: trackId,
            state: "observed",
            isrc: "USABC2600001",
            raw: { id: trackId },
          },
        ],
      });
      return {
        state: "saved",
        resultId,
        observedIsrcCount: 1,
        missingIsrcCount: 0,
        failedLookupCount: 0,
      };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          id: trackId,
          external_ids: { isrc: "usabc2600001" },
        }),
        { status: 200 },
      ),
  );
  const result = await runReleaseTrackIsrcs(actor, owner, requestId, subjectId, {
    authorize,
    rpc,
    expectedSourceResultId: sourceResultId,
    getSpotifyToken: async () => "fixture-token",
    fetcher: fetcher as typeof fetch,
  });
  expect(result).toMatchObject({
    state: "saved",
    resultId,
    observedIsrcCount: 1,
    releaseSourceResultId: sourceResultId,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(
    rpc.mock.calls.filter(([name]) => name === "claim_context_release_track_isrcs"),
  ).toHaveLength(1);
});

it("does not call Spotify when a previous attempt needs reconciliation", async () => {
  process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED = "true";
  const rpc = vi.fn(async (name: string) =>
    name === "list_context_release_track_slots"
      ? page
      : { state: "unknown", attemptId, reason: "prior lookup" },
  );
  const fetcher = vi.fn();
  const result = await runReleaseTrackIsrcs(actor, owner, requestId, subjectId, {
    authorize,
    rpc,
    getSpotifyToken: async () => "fixture-token",
    fetcher,
  });
  expect(result.state).toBe("unknown");
  expect(fetcher).not.toHaveBeenCalled();
});

it("marks an all-failed lookup unknown instead of saving invented evidence", async () => {
  process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED = "true";
  const rpc = vi.fn(async (name: string) => {
    if (name === "list_context_release_track_slots") return page;
    if (name === "claim_context_release_track_isrcs") return { state: "claimed", attemptId };
    if (name === "fail_context_enrichment") return { state: "unknown" };
    throw new Error(`Unexpected RPC ${name}`);
  });
  const fetcher = vi.fn(async () => new Response(null, { status: 429 }));
  await expect(
    runReleaseTrackIsrcs(actor, owner, requestId, subjectId, {
      authorize,
      rpc,
      getSpotifyToken: async () => "fixture-token",
      fetcher: fetcher as typeof fetch,
    }),
  ).rejects.toThrow("No verified Spotify track response");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith("fail_context_enrichment", {
    p_owner: owner,
    p_attempt: attemptId,
  });
  expect(rpc.mock.calls.some(([name]) => name === "complete_context_release_track_isrcs")).toBe(
    false,
  );
});

it.each(["policy", "workspace", "source", "request"])(
  "stops queued lookups when %s permission changes during collection",
  async change => {
    process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED = "true";
    const slots = Array.from({ length: 7 }, (_, index) => ({
      ...page.slots[0],
      slotIndex: index,
      spotifyTrackId: String(index).padStart(22, "A"),
      trackNumber: index + 1,
    }));
    const release = { ...page, slots, linkedSlots: 7, collectedSlots: 7, reportedTotal: 7 };
    let started = false;
    const rpc = vi.fn(async (name: string) => {
      if (name === "list_context_release_track_slots") {
        if (started && change === "request") throw new Error("Request cancelled");
        return started && change === "source"
          ? {
              ...release,
              sourceResultId: resultId,
              slots: slots.map(slot => ({ ...slot, sourceResultId: resultId })),
            }
          : release;
      }
      if (name === "claim_context_release_track_isrcs") return { state: "claimed", attemptId };
      if (name === "fail_context_enrichment") return { state: "unknown" };
      if (name === "complete_context_release_track_isrcs")
        return {
          state: "saved",
          resultId,
          observedIsrcCount: 7,
          missingIsrcCount: 0,
          failedLookupCount: 0,
        };
      throw new Error(`Unexpected RPC ${name}`);
    });
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      started = true;
      if (change === "policy") process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED = "false";
      return Response.json({
        id: String(url).split("/").at(-1),
        external_ids: { isrc: "USABC2600001" },
      });
    });
    await expect(
      runReleaseTrackIsrcs(actor, owner, requestId, subjectId, {
        authorize: async () => ({ ownerId: started && change === "workspace" ? actor : owner }),
        rpc,
        getSpotifyToken: async () => "fixture-token",
        fetcher,
      }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(rpc).toHaveBeenCalledWith("fail_context_enrichment", {
      p_owner: owner,
      p_attempt: attemptId,
    });
    expect(rpc.mock.calls.some(([name]) => name === "complete_context_release_track_isrcs")).toBe(
      false,
    );
  },
);
