import { expect, it, vi } from "vitest";
import { releaseVerificationWorkflow } from "../releaseVerificationWorkflow";
import { runReleaseVerificationStep } from "../runReleaseVerificationStep";
vi.mock("../runReleaseVerificationStep", () => ({ runReleaseVerificationStep: vi.fn() }));

it("routes album verification through its own durable step", async () => {
  vi.mocked(runReleaseVerificationStep).mockResolvedValueOnce({ executionId: "fixture" } as never);
  await expect(releaseVerificationWorkflow("actor", "owner", "request")).resolves.toEqual({
    executionId: "fixture",
  });
  expect(runReleaseVerificationStep).toHaveBeenCalledWith("actor", "owner", "request");
});
