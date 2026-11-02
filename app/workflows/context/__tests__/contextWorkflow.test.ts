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
  vi.resetAllMocks();
  calls.length = 0;
});

it.each(["partial", "completed"])(
  "records a review plan after %s metadata while preserving the workflow result",
  async status => {
    const request = { id: "request", status };
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
  },
);

it.each(["failed", "cancelled"])("preserves the exact %s record without planning", async status => {
  const request = { id: "request", status, error: "saved outcome", output: { marker: "retained" } };
  metadata.mockResolvedValue(request);
  plan.mockRejectedValue(new Error("Context request is not ready for planning"));
  await expect(contextWorkflow("actor", "owner", "request")).resolves.toBe(request);
  expect(metadata).toHaveBeenCalledWith("actor", "owner", "request");
  expect(plan).not.toHaveBeenCalled();
});

it("propagates a thrown runner error unchanged without planning", async () => {
  const error = new Error("runner failure");
  metadata.mockRejectedValue(error);
  await expect(contextWorkflow("actor", "owner", "request")).rejects.toBe(error);
  expect(plan).not.toHaveBeenCalled();
});

it("propagates a thrown planning error unchanged for a successful request", async () => {
  const error = new Error("planner failure");
  metadata.mockResolvedValue({ id: "request", status: "completed" });
  plan.mockRejectedValue(error);
  await expect(contextWorkflow("actor", "owner", "request")).rejects.toBe(error);
  expect(plan).toHaveBeenCalledOnce();
});
