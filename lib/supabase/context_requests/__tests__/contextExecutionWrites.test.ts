import { beforeEach, expect, it, vi } from "vitest";
import { createContextExecution } from "../createContextExecution";
import { saveContextExecutionOutcome } from "../saveContextExecutionOutcome";
import { callContextRpc } from "../callContextRpc";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
const owner = "00000000-0000-4000-8000-000000000001";
const requestId = "00000000-0000-4000-8000-000000000002";
const executionId = "00000000-0000-4000-8000-000000000003";
const subjectId = "00000000-0000-4000-8000-000000000004";
const resultId = "00000000-0000-4000-8000-000000000005";
const key = `${subjectId}:mlc_recording`;
const plan = [
  { key, subjectId, module: "mlc_recording", state: "ready_for_dispatch", dependsOn: [] },
];

beforeEach(() => vi.clearAllMocks());

it("creates a server-owned execution and saves a real MLC evidence receipt", async () => {
  rpc.mockResolvedValue({ data: { id: executionId, created: true }, error: null });
  await expect(
    createContextExecution(owner, requestId, executionId, "context-v1", plan),
  ).resolves.toMatchObject({ created: true });
  await saveContextExecutionOutcome(owner, executionId, {
    key,
    status: "saved",
    receipt: { state: "saved", resultId },
  });
  expect(rpc).toHaveBeenNthCalledWith(1, "create_context_execution", {
    p_owner: owner,
    p_request: requestId,
    p_execution: executionId,
    p_policy_version: "context-v1",
    p_plan: plan,
  });
  expect(rpc).toHaveBeenNthCalledWith(2, "save_context_execution_outcome", {
    p_owner: owner,
    p_execution: executionId,
    p_node_key: key,
    p_outcome: { key, status: "saved", receipt: { state: "saved", resultId } },
  });
});

it("returns an explicit replay signal instead of dispatching an existing execution", async () => {
  rpc.mockResolvedValue({ data: { id: executionId, created: false }, error: null });
  await expect(
    createContextExecution(owner, requestId, executionId, "context-v1", plan),
  ).resolves.toMatchObject({ created: false });
});

it("rejects false success before calling storage", async () => {
  await expect(
    saveContextExecutionOutcome(owner, executionId, {
      key,
      status: "saved",
      receipt: { state: "saved" },
    }),
  ).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});

it("stores only the result pointer and removes collector payloads", async () => {
  rpc.mockResolvedValue({ data: {}, error: null });
  await saveContextExecutionOutcome(owner, executionId, {
    key,
    status: "saved",
    receipt: { state: "saved", resultId, content: { privateSource: "never store here" } },
    providerException: "private error",
  });
  expect(JSON.stringify(rpc.mock.calls)).not.toContain("privateSource");
  expect(JSON.stringify(rpc.mock.calls)).not.toContain("providerException");
});

it("rejects cycles before saving an execution", async () => {
  await expect(
    createContextExecution(owner, requestId, executionId, "context-v1", [
      { ...plan[0], dependsOn: [key] },
    ]),
  ).rejects.toThrow("Invalid context execution dependencies");
  expect(rpc).not.toHaveBeenCalled();
});

it("does not expose execution writes as arbitrary context operations", async () => {
  await expect(callContextRpc("arbitrary_context_write", {})).rejects.toThrow(
    "Unknown context operation",
  );
  expect(rpc).not.toHaveBeenCalled();
});
