import { expect, it, vi } from "vitest";
import { runRecordedContextModules } from "../runRecordedContextModules";
vi.mock("@/lib/supabase/context_requests/claimContextExecutionNode", () => ({
  claimContextExecutionNode: vi.fn(),
}));
vi.mock("@/lib/supabase/context_requests/createContextExecution", () => ({
  createContextExecution: vi.fn(),
}));
vi.mock("@/lib/supabase/context_requests/saveContextExecutionOutcome", () => ({
  saveContextExecutionOutcome: vi.fn(),
}));

const owner = "00000000-0000-4000-8000-000000000001";
const requestId = "00000000-0000-4000-8000-000000000002";
const executionId = "00000000-0000-4000-8000-000000000003";
const subjectId = "00000000-0000-4000-8000-000000000004";
const resultId = "00000000-0000-4000-8000-000000000005";
const node = {
  key: `${subjectId}:mlc_recording`,
  subjectId,
  module: "mlc_recording",
  state: "ready_for_dispatch",
  dependsOn: [],
};
const input = { actor: owner, owner, requestId, executionId, policyVersion: "v1", plan: [node] };

it("creates a fresh execution before dispatch and saves its result pointer", async () => {
  const order: string[] = [];
  const deps = {
    authorizeExecution: vi.fn(async () => {
      order.push("authorize execution");
    }),
    authorizeNode: vi.fn(async () => {
      order.push("authorize node");
    }),
    createExecution: vi.fn(async () => {
      order.push("create execution");
      return { id: executionId, created: true };
    }),
    claimNode: vi.fn(async () => {
      order.push("claim node");
      return { state: "claimed" as const, claimId: resultId };
    }),
    dispatch: vi.fn(async () => {
      order.push("dispatch");
      return { state: "saved", resultId };
    }),
    saveOutcome: vi.fn(async () => {
      order.push("save outcome");
    }),
  };
  const result = await runRecordedContextModules(input, deps);
  expect(result[0]).toMatchObject({ status: "saved", receipt: { resultId } });
  expect(order).toEqual([
    "authorize execution",
    "create execution",
    "authorize node",
    "claim node",
    "dispatch",
    "save outcome",
  ]);
  expect(deps.saveOutcome).toHaveBeenCalledWith(
    owner,
    executionId,
    expect.objectContaining({ key: node.key, status: "saved" }),
  );
});

it("refuses replay before any provider dispatch", async () => {
  const deps = {
    authorizeExecution: vi.fn(async () => undefined),
    authorizeNode: vi.fn(async () => undefined),
    createExecution: vi.fn(async () => ({ id: executionId, created: false })),
    claimNode: vi.fn(async () => ({ state: "claimed" as const, claimId: resultId })),
    dispatch: vi.fn(async () => ({ state: "saved", resultId })),
    saveOutcome: vi.fn(async () => undefined),
  };
  await expect(runRecordedContextModules(input, deps)).rejects.toThrow(
    "Execution replay requires reconciliation",
  );
  expect(deps.claimNode).not.toHaveBeenCalled();
  expect(deps.dispatch).not.toHaveBeenCalled();
  expect(deps.saveOutcome).not.toHaveBeenCalled();
});

it.each(["unknown", "storage_error"] as const)(
  "stops an %s node claim without persisting a false failure",
  async state => {
    const deps = {
      authorizeExecution: vi.fn(async () => undefined),
      authorizeNode: vi.fn(async () => undefined),
      createExecution: vi.fn(async () => ({ id: executionId, created: true })),
      claimNode: vi.fn(async () => {
        if (state === "storage_error") throw new Error("claim response lost");
        return { state: "unknown" as const };
      }),
      dispatch: vi.fn(async () => ({ state: "saved", resultId })),
      saveOutcome: vi.fn(async () => undefined),
    };
    await expect(runRecordedContextModules(input, deps)).rejects.toThrow("reconciliation");
    expect(deps.dispatch).not.toHaveBeenCalled();
    expect(deps.saveOutcome).not.toHaveBeenCalled();
  },
);
