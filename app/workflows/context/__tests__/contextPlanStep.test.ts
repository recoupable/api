import { afterEach, expect, it, vi } from "vitest";
import { recordContextPlanStep } from "../recordContextPlanStep";

const { record } = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@/lib/context/planning/recordBlockedContextPlan", () => ({
  recordBlockedContextPlan: record,
}));
afterEach(() => {
  delete process.env.CONTEXT_RECORD_BLOCKED_PLAN_ENABLED;
  vi.clearAllMocks();
});
const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";

it("does no database or provider work when the migration gate is off", async () => {
  await expect(recordContextPlanStep(actor, owner, requestId)).resolves.toBeNull();
  expect(record).not.toHaveBeenCalled();
});

it("records the blocked plan only when explicitly enabled", async () => {
  process.env.CONTEXT_RECORD_BLOCKED_PLAN_ENABLED = "true";
  record.mockResolvedValue({ executionId: "id", nodeCount: 2 });
  await expect(recordContextPlanStep(actor, owner, requestId)).resolves.toMatchObject({
    nodeCount: 2,
  });
  expect(record).toHaveBeenCalledWith(actor, owner, requestId);
});
