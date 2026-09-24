import { afterEach, expect, it, vi } from "vitest";
import { runRecordedReleaseTrackIsrcs } from "../runRecordedReleaseTrackIsrcs";
import { ContextNodeNeedsReconciliation } from "../ContextNodeNeedsReconciliation";

vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));

const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const subjectId = "44444444-4444-4444-8444-444444444444";
const resultId = "55555555-5555-4555-8555-555555555555";
const sourceResultId = "66666666-6666-4666-8666-666666666666";
const page = {
  state: "ready",
  releaseId: "AAAAAAAAAAAAAAAAAAAAAA",
  sourceResultId,
  coverage: "full",
  collectedSlots: 1,
  reportedTotal: 1,
  linkedSlots: 1,
  unavailableSlots: 0,
  hasMore: false,
  nextCursor: null,
  slots: [
    {
      slotIndex: 0,
      spotifyTrackId: "BBBBBBBBBBBBBBBBBBBBBB",
      discNumber: 1,
      trackNumber: 1,
      sourceResultId,
    },
  ],
};
const authorize = vi.fn(async () => ({ ownerId: owner }));
afterEach(() => {
  delete process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED;
  vi.clearAllMocks();
});

it("records a source-specific node and accepts only its saved receipt", async () => {
  process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED = "true";
  const rpc = vi.fn(async () => page);
  const collect = vi.fn(async () => ({
    state: "saved" as const,
    resultId,
    observedIsrcCount: 1,
    missingIsrcCount: 0,
    failedLookupCount: 0,
  }));
  const record = vi.fn(
    async (
      input: Parameters<typeof import("../runRecordedContextModules").runRecordedContextModules>[0],
      callbacks: Parameters<
        typeof import("../runRecordedContextModules").runRecordedContextModules
      >[1],
    ) => {
      const node = input.plan as Array<{ key: string; sourceResultId: string }>;
      expect(node[0]).toMatchObject({
        key: `${subjectId}:spotify_release_track_isrcs`,
        sourceResultId,
        linkedSlots: 1,
      });
      await callbacks.authorizeExecution(actor, owner, requestId);
      await callbacks.authorizeNode(node[0] as never);
      const receipt = await callbacks.dispatch(node[0] as never, {});
      return [{ key: node[0].key, status: "saved" as const, receipt }];
    },
  );
  const result = await runRecordedReleaseTrackIsrcs(actor, owner, requestId, subjectId, {
    authorize,
    rpc,
    collect: collect as never,
    record: record as never,
  });
  expect(result.outcomes[0]).toMatchObject({ status: "saved", receipt: { resultId } });
  expect(collect).toHaveBeenCalledTimes(1);
  expect(record).toHaveBeenCalledTimes(1);
});

it("leaves an ambiguous prior attempt for reconciliation", async () => {
  process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED = "true";
  const rpc = vi.fn(async () => page);
  const collect = vi.fn(async () => ({
    state: "unknown" as const,
    attemptId: resultId,
    reason: "prior lookup",
  }));
  const record = vi.fn(
    async (
      input: Parameters<typeof import("../runRecordedContextModules").runRecordedContextModules>[0],
      callbacks: Parameters<
        typeof import("../runRecordedContextModules").runRecordedContextModules
      >[1],
    ) => {
      const node = (input.plan as Array<{ key: string }>)[0];
      await callbacks.authorizeExecution(actor, owner, requestId);
      await callbacks.authorizeNode(node as never);
      await callbacks.dispatch(node as never, {});
      return [];
    },
  );
  await expect(
    runRecordedReleaseTrackIsrcs(actor, owner, requestId, subjectId, {
      authorize,
      rpc,
      collect: collect as never,
      record: record as never,
    }),
  ).rejects.toBeInstanceOf(ContextNodeNeedsReconciliation);
  expect(collect).toHaveBeenCalledTimes(1);
});
