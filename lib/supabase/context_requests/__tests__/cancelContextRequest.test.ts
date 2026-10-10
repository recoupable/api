import { beforeEach, expect, it, vi } from "vitest";
import { cancelContextRequest } from "../cancelContextRequest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
const owner = "00000000-0000-4000-8000-000000000001";
const actor = "00000000-0000-4000-8000-000000000002";
const request = "00000000-0000-4000-8000-000000000003";
beforeEach(() => vi.clearAllMocks());

it("passes owner, actor and request to the service-only cancellation", async () => {
  const receipt = {
    outcome: "cancelled",
    request: { id: request, owner_id: owner, status: "cancelled", error: null },
  };
  rpc.mockResolvedValue({ data: receipt, error: null });
  await expect(cancelContextRequest(owner, actor, request)).resolves.toEqual(receipt);
  expect(rpc).toHaveBeenCalledWith("cancel_context_request", {
    p_owner: owner,
    p_actor: actor,
    p_request: request,
  });
});

it.each([
  { outcome: "cancelled", request: { id: request, owner_id: owner, status: "completed" } },
  { outcome: "not_cancellable", request: { id: request, owner_id: owner, status: "cancelled" } },
  { outcome: "stopped", request: { id: request, owner_id: owner, status: "cancelled" } },
  {
    outcome: "cancelled",
    request: { id: request, owner_id: owner, status: "cancelled", claim_token: "leaked" },
  },
])("rejects an inconsistent or leaking receipt %j", async receipt => {
  rpc.mockResolvedValue({ data: receipt, error: null });
  await expect(cancelContextRequest(owner, actor, request)).rejects.toThrow();
});

it("rejects malformed identifiers without calling storage and surfaces storage errors", async () => {
  await expect(cancelContextRequest("bad", actor, request)).rejects.toThrow();
  await expect(cancelContextRequest(owner, actor, "bad")).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ data: null, error: { message: "Case access denied" } });
  await expect(cancelContextRequest(owner, actor, request)).rejects.toThrow(
    "Context storage operation failed",
  );
});
