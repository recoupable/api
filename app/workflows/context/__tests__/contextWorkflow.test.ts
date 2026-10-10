import { expect, it, vi } from "vitest";
import { contextWorkflow } from "../contextWorkflow";
const { metadata, plan, calls } = vi.hoisted(() => ({
  metadata: vi.fn(),
  plan: vi.fn(),
  calls: [] as string[],
}));
vi.mock("../runContextStep", () => ({ runContextStep: metadata }));
vi.mock("../recordContextPlanStep", () => ({ recordContextPlanStep: plan }));

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

it("returns a failed request, such as a quarantined identity conflict, without planning", async () => {
  const request = { id: "request", status: "failed", output: { identityConflicts: [{}] } };
  metadata.mockResolvedValueOnce(request);
  plan.mockClear();
  await expect(contextWorkflow("actor", "owner", "request")).resolves.toBe(request);
  expect(plan).not.toHaveBeenCalled();
});
