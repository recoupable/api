import { beforeEach, expect, it, vi } from "vitest";
import { processContextOperation } from "@/lib/context/processContextOperation";
import { callContextRpc } from "../callContextRpc";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const actor = "00000000-0000-4000-8000-000000000001";
const org = "00000000-0000-4000-8000-000000000002";
const execution = "00000000-0000-4000-8000-000000000003";
const authorize = vi.fn(async () => ({ accountId: actor, ownerId: org, organizationId: org }));
const dispatch = vi.fn();
const run = (
  input: unknown = { action: "read_execution", execution_id: execution, organization_id: org },
) => processContextOperation(actor, input, { authorize, dispatch, rpc: callContextRpc });
beforeEach(() => {
  vi.clearAllMocks();
  authorize.mockResolvedValue({ accountId: actor, ownerId: org, organizationId: org });
});
it("reads saved executions through the shared authorized operation and real RPC adapter", async () => {
  const data = {
    id: execution,
    owner_id: org,
    plan: [],
    outcomes: [],
    claims: [
      { nodeKey: `${actor}:mlc_recording`, state: "unknown", claimedAt: "2026-09-23T21:00:00Z" },
    ],
  };
  rpc.mockResolvedValue({ data, error: null });
  await expect(run()).resolves.toEqual({ execution: data });
  expect(authorize).toHaveBeenCalledWith(actor, org);
  expect(rpc).toHaveBeenCalledWith("read_context_execution", {
    p_owner: org,
    p_execution: execution,
  });
  expect(dispatch).not.toHaveBeenCalled();
});
it("rejects denied workspace access before storage", async () => {
  authorize.mockRejectedValue(new Error("Access denied"));
  await expect(run()).rejects.toThrow("Access denied");
  expect(rpc).not.toHaveBeenCalled();
});
it("rejects invalid IDs and caller-supplied owner fields", async () => {
  for (const input of [
    { action: "read_execution", execution_id: "bad" },
    { action: "read_execution", execution_id: execution, owner_id: actor },
  ]) {
    await expect(run(input)).rejects.toThrow();
  }
  expect(authorize).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it("propagates missing migrations or missing executions without starting work", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "Execution unavailable" } });
  await expect(run()).rejects.toThrow("Execution unavailable");
  expect(dispatch).not.toHaveBeenCalled();
});
