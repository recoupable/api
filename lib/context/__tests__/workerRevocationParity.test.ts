import { afterEach, describe, expect, it, vi } from "vitest";
import { runContextRequest } from "../runContextRequest";
import { runReleaseVerification } from "../planning/runReleaseVerification";
import { runRecordedReleaseTrackIsrcs } from "../planning/runRecordedReleaseTrackIsrcs";
import type { runRecordedContextModules } from "../planning/runRecordedContextModules";

// Workers never reach hosted authorization or database clients in this suite.
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));

const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const subjectId = "44444444-4444-4444-8444-444444444444";
const sourceResultId = "55555555-5555-4555-8555-555555555555";
const canary = "CANARY-private-membership-detail-7f3a";
type Rpc = (name: string, params: Record<string, unknown>) => Promise<unknown>;
type Recorder = typeof runRecordedContextModules;
type Stage = "execution" | "node";

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
/** Mirrors the recorded runner's order: execution check, node check, dispatch, outcome save. */
function recorderRevokedBefore(stage: Stage, revoke: () => void, save: (r: unknown) => unknown) {
  const record: Recorder = async (input, callbacks) => {
    const node = (input.plan as Array<{ key: string }>)[0];
    if (stage === "execution") revoke();
    await callbacks.authorizeExecution(actor, owner, requestId);
    if (stage === "node") revoke();
    await callbacks.authorizeNode(node as never);
    const receipt = await callbacks.dispatch(node as never, {});
    await save(receipt);
    return [{ key: node.key, status: "saved" as const, receipt }];
  };
  return record;
}

afterEach(() => vi.unstubAllEnvs());

describe("runContextRequest", () => {
  const request = {
    id: requestId,
    owner_id: owner,
    created_by: actor,
    input: { url: "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB" },
    status: "queued",
  };
  it("revoked after extraction: no commit, failure recorded without private detail", async () => {
    const { authorize, revoke } = membership();
    const rpc = vi.fn<Rpc>(async name =>
      name === "read_context_request" ? request : name === "claim_context_request" ? true : null,
    );
    const extract = vi.fn(async () => {
      revoke();
      return { trackId: "2ay96C6SLNv9urvXKD3ecB" };
    });
    await expect(
      runContextRequest(actor, owner, requestId, { rpc, authorize, extract } as never),
    ).rejects.toThrow(canary);
    const names = rpc.mock.calls.map(([name]) => name);
    expect(names).not.toContain("commit_spotify_context");
    expect(names).toContain("fail_context_request");
    const failure = rpc.mock.calls.find(([name]) => name === "fail_context_request")![1];
    expect(JSON.stringify(failure)).not.toContain(canary);
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(extract).toHaveBeenCalledTimes(1);
  });
});

describe("runReleaseVerification", () => {
  const target = {
    subjectId,
    kind: "release",
    identityConfirmed: false,
    availableFields: ["spotify_id"],
    reusableModules: [],
  };
  it.each<Stage>(["execution", "node"])(
    "revoked before %s authorization: no provider dispatch, no outcome saved",
    async stage => {
      vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "true");
      const { authorize, revoke } = membership();
      const rpc = vi.fn<Rpc>(async () => target);
      const dispatch = vi.fn();
      const getSpotifyToken = vi.fn();
      const save = vi.fn();
      await expect(
        runReleaseVerification(actor, owner, requestId, {
          authorize,
          rpc: rpc as never,
          record: recorderRevokedBefore(stage, revoke, save),
          dispatch,
          getSpotifyToken,
        }),
      ).rejects.toThrow(canary);
      expect(dispatch).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
      expect(getSpotifyToken).not.toHaveBeenCalled();
      expect(rpc.mock.calls.every(([name]) => name === "list_context_release_request_target")).toBe(
        true,
      );
    },
  );
});

describe("runRecordedReleaseTrackIsrcs", () => {
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
  it.each<Stage>(["execution", "node"])(
    "revoked before %s authorization: no collector, credentials or outcome save",
    async stage => {
      vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED", "true");
      const { authorize, revoke } = membership();
      const rpc = vi.fn<Rpc>(async () => page);
      const collect = vi.fn();
      const getSpotifyToken = vi.fn();
      const save = vi.fn();
      await expect(
        runRecordedReleaseTrackIsrcs(actor, owner, requestId, subjectId, {
          authorize,
          rpc,
          record: recorderRevokedBefore(stage, revoke, save),
          collect: collect as never,
          getSpotifyToken,
        }),
      ).rejects.toThrow(canary);
      expect(collect).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
      expect(getSpotifyToken).not.toHaveBeenCalled();
      expect(rpc.mock.calls.every(([name]) => name === "list_context_release_track_slots")).toBe(
        true,
      );
    },
  );
});
