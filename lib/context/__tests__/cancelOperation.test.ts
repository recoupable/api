import { beforeEach, describe, expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";
const { authorize, cancel } = vi.hoisted(() => ({ authorize: vi.fn(), cancel: vi.fn() }));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: authorize }));
vi.mock("@/lib/supabase/context_requests/cancelContextRequest", () => ({
  cancelContextRequest: cancel,
}));
const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const other = "00000000-0000-4000-8000-000000000004";
const deps = () => ({ rpc: vi.fn(), dispatch: vi.fn() });
beforeEach(() => {
  vi.clearAllMocks();
  authorize.mockResolvedValue({ ownerId: owner });
});

describe("cancel context request operation", () => {
  it("cancels under the selected workspace with the actor and never dispatches", async () => {
    const receipt = {
      outcome: "cancelled",
      request: { id: requestId, owner_id: owner, status: "cancelled" },
    };
    cancel.mockResolvedValue(receipt);
    const injected = deps();
    await expect(
      processContextOperation(
        actor,
        { action: "cancel", request_id: requestId, organization_id: owner },
        injected,
      ),
    ).resolves.toEqual(receipt);
    expect(authorize).toHaveBeenCalledWith(actor, owner);
    expect(cancel).toHaveBeenCalledWith(owner, actor, requestId);
    expect(injected.rpc).not.toHaveBeenCalled();
    expect(injected.dispatch).not.toHaveBeenCalled();
  });
  it("returns a completed request unchanged as not_cancellable", async () => {
    const receipt = {
      outcome: "not_cancellable",
      request: { id: requestId, owner_id: owner, status: "completed", output: { subjectIds: [] } },
    };
    cancel.mockResolvedValue(receipt);
    const injected = deps();
    await expect(
      processContextOperation(actor, { action: "cancel", request_id: requestId }, injected),
    ).resolves.toEqual(receipt);
    expect(injected.dispatch).not.toHaveBeenCalled();
  });
  it.each([
    { action: "cancel", request_id: requestId, force: true },
    { action: "cancel", request_id: "not-a-uuid" },
    { action: "cancel" },
  ])("rejects malformed input %j before any access check or write", async input => {
    await expect(processContextOperation(actor, input, deps())).rejects.toThrow();
    expect(authorize).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });
  it("accepts the stored owner when the caller spelled the workspace UUID in uppercase", async () => {
    const upper = "A19F0000-0000-4000-8000-0000000000AB";
    authorize.mockResolvedValue({ ownerId: upper });
    const receipt = {
      outcome: "cancelled",
      request: { id: requestId, owner_id: upper.toLowerCase(), status: "cancelled" },
    };
    cancel.mockResolvedValue(receipt);
    await expect(
      processContextOperation(
        actor,
        { action: "cancel", request_id: requestId, organization_id: upper },
        deps(),
      ),
    ).resolves.toEqual(receipt);
    expect(cancel).toHaveBeenCalledWith(upper, actor, requestId);
  });
  it("rejects a receipt owned by another workspace", async () => {
    cancel.mockResolvedValue({
      outcome: "cancelled",
      request: { id: requestId, owner_id: other, status: "cancelled" },
    });
    await expect(
      processContextOperation(actor, { action: "cancel", request_id: requestId }, deps()),
    ).rejects.toThrow("Context request not found");
  });
});
