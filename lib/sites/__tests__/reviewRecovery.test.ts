import { expect, it, vi } from "vitest";
import { RetryableError, FatalError } from "workflow";
import { reviewStep } from "@/app/workflows/sites/reviewStep";
const review = vi.hoisted(() => vi.fn());
vi.mock("../production/reviewExperience", () => ({ reviewExperience: review }));
it.each([
  new Error(
    "Site review browser playthrough failed: Rendered review did not complete: page.screenshot: Timeout 30000ms exceeded.",
  ),
  Object.assign(new Error("No object generated: response did not match schema."), {
    name: "AI_NoObjectGeneratedError",
  }),
])("retries an interrupted review without discarding the build", async error => {
  review.mockRejectedValueOnce(error);
  await expect(reviewStep({} as never, {} as never, "account", "site")).rejects.toBeInstanceOf(
    RetryableError,
  );
});
it("does not retry an authorization failure", async () => {
  review.mockRejectedValueOnce(new Error("Unauthorized"));
  await expect(reviewStep({} as never, {} as never, "account", "site")).rejects.toBeInstanceOf(
    FatalError,
  );
});
