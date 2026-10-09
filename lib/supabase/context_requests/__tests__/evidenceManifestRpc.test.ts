import { expect, it, vi } from "vitest";
import { callContextRpc } from "../callContextRpc";
import { processContextOperation } from "@/lib/context/processContextOperation";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../serverClient", () => ({ default: { rpc } }));
vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
const request = "22222222-2222-4222-8222-222222222222";
it("connects evidence discovery through the real RPC adapter", async () => {
  const page = {
    request_id: request,
    owner_id: actor,
    versions: [],
    has_more: false,
    next_id: null,
  };
  rpc.mockResolvedValue({ data: page, error: null });
  const dispatch = vi.fn();
  expect(
    await processContextOperation(
      actor,
      { action: "list_evidence_versions", request_id: request },
      {
        rpc: callContextRpc,
        dispatch,
        authorize: async () => ({ accountId: actor, ownerId: actor, organizationId: null }),
      },
    ),
  ).toEqual(page);
  expect(rpc).toHaveBeenLastCalledWith("list_context_request_evidence_versions", {
    p_actor: actor,
    p_owner: actor,
    p_request: request,
    p_after: null,
  });
  expect(dispatch).not.toHaveBeenCalled();
});
it("does not expose the unbounded helper through the adapter", async () => {
  rpc.mockClear();
  await expect(callContextRpc("context_request_evidence_versions", {})).rejects.toThrow(
    "Unknown context operation",
  );
  expect(rpc).not.toHaveBeenCalled();
});
