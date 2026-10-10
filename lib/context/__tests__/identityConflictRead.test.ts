import { describe, expect, it, vi } from "vitest";
import { runContextRequest } from "../runContextRequest";

const id = "2ay96C6SLNv9urvXKD3ecB";
const request = {
  id: "request",
  owner_id: "owner",
  created_by: "actor",
  input: { url: `https://open.spotify.com/track/${id}`, topics: ["release_metadata"] },
  status: "queued",
};
/** Shape written by database commit_spotify_context when the track is already mapped elsewhere. */
const quarantined = {
  ...request,
  status: "failed",
  error:
    "identity_conflict: This Spotify track is already mapped to a different ISRC. The conflicting evidence was saved for review and nothing was accepted; retry this request after the mapping is resolved.",
  output: {
    identityConflicts: [
      {
        providerId: id,
        observedIsrc: "USABC2600001",
        existingIsrcs: ["USABC2500009"],
        linkIds: ["44444444-4444-4444-8444-444444444444"],
      },
    ],
    subjectIds: [],
    artists: [],
    gaps: [],
    providerCostMicros: 0,
    model: null,
  },
};

function setup(commitResult: unknown, read: unknown = request) {
  const rpc = vi.fn(async (name: string) =>
    name === "read_context_request"
      ? read
      : name === "claim_context_request"
        ? true
        : name === "commit_spotify_context"
          ? commitResult
          : undefined,
  );
  return {
    rpc,
    authorize: vi.fn(async () => undefined),
    extract: vi.fn(async () => ({ trackId: id })),
  };
}

describe("identity conflict quarantine read-through", () => {
  it("returns the quarantined request unchanged and keeps its specific conflict error", async () => {
    const deps = setup(quarantined);
    const result = await runContextRequest("actor", "owner", "request", deps as never);
    expect(result).toBe(quarantined);
    expect(result).toMatchObject({
      status: "failed",
      error: expect.stringMatching(/^identity_conflict: /),
      output: { identityConflicts: quarantined.output.identityConflicts, subjectIds: [] },
    });
    expect(deps.rpc).toHaveBeenCalledWith(
      "commit_spotify_context",
      expect.objectContaining({ p_request: "request" }),
    );
    expect(deps.rpc.mock.calls.some(([name]) => name === "fail_context_request")).toBe(false);
  });
  it("retries a quarantined request through the ordinary claim path once resolved", async () => {
    const resolved = { ...request, status: "completed" };
    const deps = setup(resolved, quarantined);
    const result = await runContextRequest("actor", "owner", "request", deps as never);
    expect(result).toBe(resolved);
    expect(deps.extract).toHaveBeenCalledTimes(1);
    expect(deps.rpc).toHaveBeenCalledWith(
      "claim_context_request",
      expect.objectContaining({ p_request: "request" }),
    );
  });
});
