import { beforeEach, expect, it, vi } from "vitest";
import { recordBlockedContextPlan } from "../recordBlockedContextPlan";

const { plan, create, save } = vi.hoisted(() => ({
  plan: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
}));
vi.mock("../planStoredContextModules", () => ({ planStoredContextModules: plan }));
vi.mock("@/lib/supabase/context_requests/createContextExecution", () => ({
  createContextExecution: create,
}));
vi.mock("@/lib/supabase/context_requests/saveContextExecutionOutcome", () => ({
  saveContextExecutionOutcome: save,
}));
const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const subjectId = "00000000-0000-4000-8000-000000000004";
const blocked = {
  key: `${subjectId}:mlc_recording`,
  subjectId,
  module: "mlc_recording",
  state: "blocked",
  reasons: ["Server collection policy has not permitted this module"],
  dependsOn: [],
  executionStarted: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  plan.mockResolvedValue({ requestId, entry: "song", plan: [blocked], collectionPermitted: false });
  create.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000005", created: true });
  save.mockResolvedValue({});
});

it("records only blocked outcomes with a deterministic execution ID", async () => {
  const first = await recordBlockedContextPlan(actor, owner, requestId);
  const second = await recordBlockedContextPlan(actor, owner, requestId);
  expect(first.executionId).toBe(second.executionId);
  expect(create).toHaveBeenCalledWith(owner, requestId, first.executionId, "metadata-review-v1", [
    blocked,
  ]);
  expect(save).toHaveBeenCalledWith(owner, first.executionId, {
    key: blocked.key,
    status: "blocked",
    blockReason: "plan_blocked",
    blockedBy: [],
    reasons: blocked.reasons,
  });
});

it("rejects a runnable plan before creating any execution", async () => {
  plan.mockResolvedValue({
    requestId,
    entry: "song",
    plan: [{ ...blocked, state: "ready_for_dispatch" }],
    collectionPermitted: false,
  });
  await expect(recordBlockedContextPlan(actor, owner, requestId)).rejects.toThrow(
    "only record blocked plans",
  );
  expect(create).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

it("does not claim providers even when the execution already exists", async () => {
  create.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000005", created: false });
  await recordBlockedContextPlan(actor, owner, requestId);
  expect(save).toHaveBeenCalledTimes(1);
});
