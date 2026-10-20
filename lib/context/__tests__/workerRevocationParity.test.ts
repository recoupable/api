import { afterEach, describe, expect, it, vi } from "vitest";
import { runContextRequest } from "../runContextRequest";
import {
  runContextEnrichment,
  type ContextEnrichmentResult,
} from "../enrichment/runContextEnrichment";
import { runGuestContext } from "../guest/runGuestContext";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { runReleaseVerification } from "../planning/runReleaseVerification";
import { runRecordedReleaseTrackIsrcs } from "../planning/runRecordedReleaseTrackIsrcs";
import { runRecordedContextModules } from "../planning/runRecordedContextModules";
import { recordContextPlanStep } from "@/app/workflows/context/recordContextPlanStep";

type Rpc = (name: string, params: Record<string, unknown>) => Promise<unknown>;
// One database boundary for every worker: the real recorder, execution wrappers and planners
// reach the same mocked RPC, so each persisted record can be inspected for private detail.
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn<Rpc>() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: rpc }));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const subjectId = "44444444-4444-4444-8444-444444444444";
const sourceResultId = "55555555-5555-4555-8555-555555555555";
const executionRow = "66666666-6666-4666-8666-666666666666";
const claimId = "77777777-7777-4777-8777-777777777777";
const attemptId = "88888888-8888-4888-8888-888888888888";
const canary = "CANARY-private-membership-detail-7f3a";
type Recorder = typeof runRecordedContextModules;

/** Membership that is valid when work is queued and revoked at a chosen later point. */
function membership() {
  let revoked = false;
  return {
    revoke: () => {
      revoked = true;
    },
    authorize: vi.fn(async () => {
      if (revoked) throw new Error(`Access denied: ${canary}`);
      return { ownerId: owner };
    }),
  };
}
/** Pass-through to the real recorder; it only times the revocation before execution authorization. */
function revokeThenRecord(revoke: () => void): Recorder {
  return (input, callbacks) => {
    revoke();
    return runRecordedContextModules(input, callbacks);
  };
}
/** Routes the recorder's execution RPCs; `onCreate` runs once the execution row exists. */
function routeRecorderRpc(reads: Record<string, unknown>, onCreate: () => void) {
  rpc.mockImplementation(async name => {
    if (name in reads) return reads[name];
    if (name === "create_context_execution") {
      onCreate();
      return { id: executionRow, created: true };
    }
    if (name === "claim_context_execution_node") return { state: "claimed", claimId };
    if (name === "save_context_execution_outcome") return {};
    throw new Error(`Unexpected RPC ${name}`);
  });
}
const rpcNames = () => rpc.mock.calls.map(([name]) => name);
const savedOutcomes = () =>
  rpc.mock.calls.filter(([name]) => name === "save_context_execution_outcome").map(([, p]) => p);
/** Every record a worker wrote is customer-readable; none may carry the revocation detail. */
function expectNoPrivateDetailPersisted() {
  expect(JSON.stringify(rpc.mock.calls)).not.toContain(canary);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("runContextRequest", () => {
  const request = {
    id: requestId,
    owner_id: owner,
    created_by: actor,
    input: { url: "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB" },
    status: "queued",
  };
  it("revoked during extraction: no commit, failure recorded without private detail", async () => {
    const { authorize, revoke } = membership();
    rpc.mockImplementation(async name =>
      name === "read_context_request" ? request : name === "claim_context_request" ? true : null,
    );
    const extract = vi.fn(async () => {
      revoke();
      return { trackId: "2ay96C6SLNv9urvXKD3ecB" };
    });
    await expect(
      runContextRequest(actor, owner, requestId, { rpc, authorize, extract } as never),
    ).rejects.toThrow(canary);
    expect(rpcNames()).not.toContain("commit_spotify_context");
    expect(rpcNames()).toContain("fail_context_request");
    expectNoPrivateDetailPersisted();
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(extract).toHaveBeenCalledTimes(1);
  });
});

describe("runReleaseVerification (real recorder and execution wrappers)", () => {
  const target = {
    subjectId,
    kind: "release",
    identityConfirmed: false,
    availableFields: ["spotify_id"],
    reusableModules: [],
  };
  const reads = { list_context_release_request_target: target };
  const key = `${subjectId}:spotify_release`;

  it("revoked before execution authorization: rejects, nothing recorded or dispatched", async () => {
    vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "true");
    const { authorize, revoke } = membership();
    routeRecorderRpc(reads, () => undefined);
    const dispatch = vi.fn();
    const getSpotifyToken = vi.fn();
    await expect(
      runReleaseVerification(actor, owner, requestId, {
        authorize,
        dispatch,
        getSpotifyToken,
        record: revokeThenRecord(revoke),
      }),
    ).rejects.toThrow(canary);
    expect(rpcNames()).toEqual(["list_context_release_request_target"]);
    expect(dispatch).not.toHaveBeenCalled();
    expect(getSpotifyToken).not.toHaveBeenCalled();
  });

  it("revoked before node authorization: node fails at authorize, generic outcome saved once", async () => {
    vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "true");
    const { authorize, revoke } = membership();
    routeRecorderRpc(reads, revoke);
    const dispatch = vi.fn();
    const getSpotifyToken = vi.fn();
    const result = await runReleaseVerification(actor, owner, requestId, {
      authorize,
      dispatch,
      getSpotifyToken,
    });
    const failed = { key, status: "failed", failureStage: "authorize" };
    expect(result.outcomes).toEqual([failed]);
    expect(dispatch).not.toHaveBeenCalled();
    expect(getSpotifyToken).not.toHaveBeenCalled();
    expect(rpcNames()).not.toContain("claim_context_execution_node");
    expect(savedOutcomes()).toEqual([
      { p_owner: owner, p_execution: result.executionId, p_node_key: key, p_outcome: failed },
    ]);
    expectNoPrivateDetailPersisted();
  });
});

describe("runRecordedReleaseTrackIsrcs (real recorder and execution wrappers)", () => {
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
  const reads = { list_context_release_track_slots: page };
  const key = `${subjectId}:spotify_release_track_isrcs`;

  it("revoked before execution authorization: rejects, nothing recorded or collected", async () => {
    vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED", "true");
    const { authorize, revoke } = membership();
    routeRecorderRpc(reads, () => undefined);
    const collect = vi.fn();
    const getSpotifyToken = vi.fn();
    await expect(
      runRecordedReleaseTrackIsrcs(actor, owner, requestId, subjectId, {
        authorize,
        collect: collect as never,
        getSpotifyToken,
        record: revokeThenRecord(revoke),
      }),
    ).rejects.toThrow(canary);
    expect(rpcNames().every(name => name === "list_context_release_track_slots")).toBe(true);
    expect(collect).not.toHaveBeenCalled();
    expect(getSpotifyToken).not.toHaveBeenCalled();
  });

  it("revoked before node authorization: node fails at authorize, generic outcome saved once", async () => {
    vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED", "true");
    const { authorize, revoke } = membership();
    routeRecorderRpc(reads, revoke);
    const collect = vi.fn();
    const getSpotifyToken = vi.fn();
    const result = await runRecordedReleaseTrackIsrcs(actor, owner, requestId, subjectId, {
      authorize,
      collect: collect as never,
      getSpotifyToken,
    });
    const failed = { key, status: "failed", failureStage: "authorize" };
    expect(result.outcomes).toEqual([failed]);
    expect(collect).not.toHaveBeenCalled();
    expect(getSpotifyToken).not.toHaveBeenCalled();
    expect(rpcNames()).not.toContain("claim_context_execution_node");
    expect(savedOutcomes()).toEqual([
      { p_owner: owner, p_execution: result.executionId, p_node_key: key, p_outcome: failed },
    ]);
    expectNoPrivateDetailPersisted();
  });
});

describe("runContextEnrichment", () => {
  const module = {
    key: `${subjectId}:song_summary`,
    topic: "song_summary",
    subjectId,
    provider: "fixture",
    model: "fixture",
    input: {},
    sources: [],
  };
  const result: ContextEnrichmentResult = {
    content: { summary: "fixture" },
    coverage: "full",
    trace: {},
    costUsd: null,
    costStatus: "unknown",
  };

  it("revoked while queued: no claim and no paid call", async () => {
    const { authorize, revoke } = membership();
    revoke();
    const call = vi.fn();
    await expect(
      runContextEnrichment(actor, owner, requestId, module, { authorize, rpc, call }),
    ).rejects.toThrow(canary);
    expect(rpc).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });

  it("revoked during the paid call: no completion, attempt failed without private detail", async () => {
    const { authorize, revoke } = membership();
    rpc.mockImplementation(async name =>
      name === "claim_context_enrichment" ? { state: "claimed", attemptId } : null,
    );
    const call = vi.fn(async () => {
      revoke();
      return result;
    });
    await expect(
      runContextEnrichment(actor, owner, requestId, module, { authorize, rpc, call }),
    ).rejects.toThrow(canary);
    expect(rpcNames()).toEqual(["claim_context_enrichment", "fail_context_enrichment"]);
    expect(rpc).toHaveBeenLastCalledWith("fail_context_enrichment", {
      p_owner: owner,
      p_attempt: attemptId,
    });
    expectNoPrivateDetailPersisted();
  });
});

describe("runGuestContext", () => {
  it("adopted guest revoked during extraction: no completion, failure without private detail", async () => {
    const { authorize, revoke } = membership();
    rpc.mockImplementation(async name =>
      name === "claim_context_guest_worker"
        ? { input: { trackId: "2ay96C6SLNv9urvXKD3ecB" } }
        : name === "context_guest_worker_scope"
          ? { actor, owner }
          : null,
    );
    const extract = vi.fn(async () => {
      revoke();
      return {} as never;
    });
    await expect(runGuestContext(requestId, { rpc, extract, authorize })).rejects.toThrow(canary);
    expect(authorize).toHaveBeenCalledExactlyOnceWith(actor, owner);
    expect(rpcNames()).not.toContain("complete_context_guest");
    const failure = rpc.mock.calls.find(([name]) => name === "fail_context_guest")![1];
    expect(Object.keys(failure).sort()).toEqual(["p_id", "p_token"]);
    expectNoPrivateDetailPersisted();
  });
});

describe("recordContextPlanStep (contextWorkflow review step)", () => {
  it("revoked while queued: no request read, execution or outcome is recorded", async () => {
    vi.stubEnv("CONTEXT_RECORD_BLOCKED_PLAN_ENABLED", "true");
    vi.mocked(authorizeContextOwner).mockRejectedValue(new Error(`Access denied: ${canary}`));
    await expect(recordContextPlanStep(actor, owner, requestId)).rejects.toThrow(canary);
    expect(authorizeContextOwner).toHaveBeenCalledExactlyOnceWith(actor, owner);
    expect(rpc).not.toHaveBeenCalled();
  });
});
