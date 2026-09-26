import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";

vi.mock("../authorizeContextOwner", () => ({
  authorizeContextOwner: vi.fn(async (id: string) => ({ ownerId: id })),
}));
const owner = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const briefId = "33333333-3333-4333-8333-333333333333";

it("compiles and saves server-built output with its input manifest", async () => {
  const dispatch = vi.fn();
  const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
    expect(params.p_owner).toBe(owner);
    if (name === "read_context_request")
      return { id: requestId, owner_id: owner, status: "completed", output: { subjectIds: [] } };
    if (name === "read_context_documents") return [];
    if (name === "save_context_brief") {
      expect(params).toMatchObject({
        p_key: "pitch-v1",
        p_snapshot: {
          purpose: "playlist_pitch",
          request_ids: [requestId],
          input_manifest: { compilerVersion: "context-brief-v1" },
        },
      });
      return { id: briefId, state: "saved", brief: params.p_snapshot };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
  const result = await processContextOperation(
    owner,
    {
      action: "save_brief",
      request_id: requestId,
      purpose: "playlist_pitch",
      idempotency_key: "pitch-v1",
    },
    { rpc, dispatch },
  );
  expect(result).toMatchObject({
    snapshot: { id: briefId, state: "saved", brief: { readiness: "partial" } },
  });
  expect(dispatch).not.toHaveBeenCalled();
});

it.each(["saved", "unavailable"])("reads a %s snapshot without recompiling", async state => {
  const snapshot = {
    id: briefId,
    state,
    brief: state === "saved" ? { text: "Frozen output" } : null,
  };
  const rpc = vi.fn(async () => snapshot);
  const dispatch = vi.fn();
  await expect(
    processContextOperation(owner, { action: "read_brief", brief_id: briefId }, { rpc, dispatch }),
  ).resolves.toEqual({ snapshot });
  expect(rpc).toHaveBeenCalledExactlyOnceWith("read_context_brief", {
    p_owner: owner,
    p_brief: briefId,
  });
  expect(dispatch).not.toHaveBeenCalled();
});

it("does not accept caller-authored snapshot content", async () => {
  const rpc = vi.fn();
  await expect(
    processContextOperation(
      owner,
      {
        action: "save_brief",
        request_id: requestId,
        purpose: "playlist_pitch",
        idempotency_key: "pitch-v1",
        snapshot: { text: "Forged" },
      },
      { rpc, dispatch: vi.fn() },
    ),
  ).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
