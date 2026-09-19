import { expect, it } from "vitest";
import { validateExperienceContract } from "../production/validateExperienceContract";
import { enforceJourneyReview } from "../production/enforceJourneyReview";
const contract = {
  releaseConnection: "The official visual uses a floating arcade world.",
  evidence: ["https://example.com/official-video"],
  motivation: "Master a short skill challenge and compare your result with a friend.",
  payoff: "A completed, downloadable score poster.",
  capabilities: ["browser-interaction", "image-download"],
  steps: [
    { action: "click", target: "Start", value: "", expected: "Choose", checkpoint: "participate" },
    { action: "click", target: "Finish", value: "", expected: "Your result", checkpoint: "result" },
    { action: "download", target: "Download", value: "", expected: "", checkpoint: "delivery" },
  ],
};
it("rejects unsupported visitor generation before asset spending", () => {
  expect(() =>
    validateExperienceContract({ ...contract, capabilities: ["visitor-ai-image"] }),
  ).toThrow();
});
it("requires participation, result and delivery evidence", () => {
  expect(() =>
    validateExperienceContract({ ...contract, steps: contract.steps.slice(0, 1) }),
  ).toThrow();
});
it("requires download proof for an image download promise", () => {
  expect(() =>
    validateExperienceContract({
      ...contract,
      steps: contract.steps.map(s => ({ ...s, action: "click" })),
    }),
  ).toThrow();
});
it("accepts an implementable complete journey", () => {
  expect(validateExperienceContract(contract).payoff).toBe(contract.payoff);
});
it("overrides a model pass when a journey failed or is missing", () => {
  for (const reports of [
    [],
    [{ name: "mobile", journeyPassed: false, errors: [], overflow: false }],
  ]) {
    const review = enforceJourneyReview(
      { verdict: "pass", issues: [], summary: "Looks good" },
      reports,
    );
    expect(review.verdict).toBe("revise");
    expect(review.issues.some(i => i.severity === "blocking")).toBe(true);
  }
});
it("requires both viewport journeys", () => {
  expect(
    enforceJourneyReview({ verdict: "pass", issues: [], summary: "OK" }, [
      { name: "mobile", journeyPassed: true, errors: [], overflow: false },
      { name: "desktop", journeyPassed: true, errors: [], overflow: false },
    ]).verdict,
  ).toBe("pass");
});
