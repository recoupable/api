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
