import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));

const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const subjectId = "00000000-0000-4000-8000-000000000004";
const input = {
  action: "list_release_tracks",
  request_id: requestId,
  subject_id: subjectId,
  organization_id: owner,
  after_slot: 10,
  limit: 25,
};

it("reads only the selected workspace's request-bound release page", async () => {
  const authorize = vi.fn(async () => ({
    accountId: actor,
    ownerId: owner,
    organizationId: owner,
  }));
  const rpc = vi.fn(async () => ({ state: "ready", slots: [], hasMore: false }));
  const dispatch = vi.fn();
  await expect(
    processContextOperation(actor, input, { authorize, rpc, dispatch }),
  ).resolves.toEqual({ page: { state: "ready", slots: [], hasMore: false } });
  expect(authorize).toHaveBeenCalledWith(actor, owner);
  expect(rpc).toHaveBeenCalledWith("list_context_release_track_slots", {
    p_owner: owner,
    p_request: requestId,
    p_subject: subjectId,
    p_after_slot: 10,
    p_limit: 25,
  });
  expect(dispatch).not.toHaveBeenCalled();
});

it("stops before storage when workspace authorization fails", async () => {
  const rpc = vi.fn();
  await expect(
    processContextOperation(actor, input, {
      authorize: async () => {
        throw new Error("No workspace access");
      },
      rpc,
      dispatch: vi.fn(),
    }),
  ).rejects.toThrow("No workspace access");
  expect(rpc).not.toHaveBeenCalled();
});

it("rejects an invalid page before authorization or storage", async () => {
  const authorize = vi.fn();
  const rpc = vi.fn();
  await expect(
    processContextOperation(
      actor,
      { ...input, after_slot: -2 },
      { authorize, rpc, dispatch: vi.fn() },
    ),
  ).rejects.toThrow();
  expect(authorize).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

it("authorizes the exact workspace before starting the gated track lookup", async () => {
  process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED = "true";
  const authorize = vi.fn(async () => ({
    accountId: actor,
    ownerId: owner,
    organizationId: owner,
  }));
  const dispatchReleaseTracks = vi.fn(async () => ({ id: "queued" }));
  const rpc = vi.fn(async () => ({ state: "ready", linkedSlots: 1, hasMore: false }));
  await expect(
    processContextOperation(
      actor,
      {
        action: "verify_release_tracks",
        request_id: requestId,
        subject_id: subjectId,
        organization_id: owner,
      },
      { authorize, rpc, dispatch: vi.fn(), dispatchReleaseTracks },
    ),
  ).resolves.toEqual({
    request_id: requestId,
    subject_id: subjectId,
    lookupQueued: true,
  });
  expect(authorize).toHaveBeenCalledWith(actor, owner);
  expect(dispatchReleaseTracks).toHaveBeenCalledWith(actor, owner, requestId, subjectId);
  expect(rpc).toHaveBeenCalledWith("list_context_release_track_slots", {
    p_owner: owner,
    p_request: requestId,
    p_subject: subjectId,
    p_after_slot: -1,
    p_limit: 100,
  });
  delete process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED;
});

it("does not queue track lookups while the server policy is off", async () => {
  delete process.env.CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED;
  const rpc = vi.fn();
  const dispatchReleaseTracks = vi.fn();
  await expect(
    processContextOperation(
      actor,
      {
        action: "verify_release_tracks",
        request_id: requestId,
        subject_id: subjectId,
      },
      {
        authorize: async () => ({ ownerId: actor, accountId: actor, organizationId: null }),
        rpc,
        dispatch: vi.fn(),
        dispatchReleaseTracks,
      },
    ),
  ).rejects.toThrow("not enabled");
  expect(rpc).not.toHaveBeenCalled();
  expect(dispatchReleaseTracks).not.toHaveBeenCalled();
});
