import { beforeEach, expect, it, vi } from "vitest";
import { claimContextExecutionNode } from "../claimContextExecutionNode";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
const owner = "00000000-0000-4000-8000-000000000001";
const execution = "00000000-0000-4000-8000-000000000002";
const node = "00000000-0000-4000-8000-000000000003:mlc_recording";
const claimId = "00000000-0000-4000-8000-000000000004";

beforeEach(() => vi.clearAllMocks());

it("returns a one-time claim for an authorized execution node", async () => {
  rpc.mockResolvedValue({ data: { state: "claimed", claimId }, error: null });
  await expect(claimContextExecutionNode(owner, execution, node)).resolves.toEqual({
    state: "claimed",
    claimId,
  });
  expect(rpc).toHaveBeenCalledWith("claim_context_execution_node", {
    p_owner: owner,
    p_execution: execution,
    p_node_key: node,
  });
});

it("exposes an uncertain replay without granting another dispatch", async () => {
  rpc.mockResolvedValue({ data: { state: "unknown", claimId }, error: null });
  await expect(claimContextExecutionNode(owner, execution, node)).resolves.toEqual({
    state: "unknown",
    claimId,
  });
});

it("rejects malformed identity before the database call", async () => {
  await expect(claimContextExecutionNode(owner, execution, "wrong-node")).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
