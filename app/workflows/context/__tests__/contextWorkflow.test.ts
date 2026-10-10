import { beforeEach, expect, it, vi } from "vitest";
import { contextWorkflow } from "../contextWorkflow";
const { metadata, plan, calls } = vi.hoisted(() => ({
  metadata: vi.fn(),
  plan: vi.fn(),
  calls: [] as string[],
}));
vi.mock("../runContextStep", () => ({ runContextStep: metadata }));
vi.mock("../recordContextPlanStep", () => ({ recordContextPlanStep: plan }));
beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
});

it("records a review plan after metadata while preserving the workflow result", async () => {
  const request = { id: "request", status: "partial" };
  metadata.mockImplementation(async () => {
    calls.push("metadata");
    return request;
  });
  plan.mockImplementation(async () => {
    calls.push("plan");
    return null;
  });
  await expect(contextWorkflow("actor", "owner", "request")).resolves.toBe(request);
  expect(calls).toEqual(["metadata", "plan"]);
  expect(plan).toHaveBeenCalledWith("actor", "owner", "request");
});

it("ends a cancelled request's run with its saved state and plans nothing", async () => {
  const request = { id: "request", status: "cancelled" };
  metadata.mockResolvedValue(request);
  await expect(contextWorkflow("actor", "owner", "request")).resolves.toBe(request);
  expect(plan).not.toHaveBeenCalled();
});
