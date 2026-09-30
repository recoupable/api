import { beforeEach, expect, it, vi } from "vitest";
import { reviewOpeningSequence } from "../production/reviewOpeningSequence";
import { generateProductionObject } from "../production/generateProductionObject";
vi.mock("../production/generateProductionObject", () => ({ generateProductionObject: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it("reviews only fresh mobile and desktop frames without the solution or later outcomes", async () => {
  vi.mocked(generateProductionObject).mockResolvedValue({
    verdict: "pass",
    observations: [],
    issues: [],
    summary: "Clear invitation",
  });
  await reviewOpeningSequence(
    ["mobile-initial", "mobile-result", "desktop-initial", "desktop-result", "secret-payoff"],
    "account",
    "site",
  );
  const call = vi.mocked(generateProductionObject).mock.calls[0];
  expect(call[2]).toEqual({ viewports: ["mobile", "desktop"] });
  expect(call[3]).toEqual(["mobile-initial", "desktop-initial"]);
});
it("does not call the model or pass when initial viewport evidence is missing", async () => {
  const result = await reviewOpeningSequence(["mobile"], "account", "site");
  expect(result.verdict).toBe("revise");
  expect(result.issues[0].severity).toBe("blocking");
  expect(generateProductionObject).not.toHaveBeenCalled();
});
