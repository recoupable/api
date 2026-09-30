import { beforeEach, expect, it, vi } from "vitest";
import { reviewExperience } from "../production/reviewExperience";
import { renderReviewedJourney } from "../production/renderReviewedJourney";
import { reviewOpeningSequence } from "../production/reviewOpeningSequence";
import { generateProductionObject } from "../production/generateProductionObject";
import type { SiteSnapshot } from "../schema";
import type { CreativeDirection } from "../production/schema";
vi.mock("../production/renderReviewedJourney", () => ({ renderReviewedJourney: vi.fn() }));
vi.mock("../production/reviewOpeningSequence", () => ({ reviewOpeningSequence: vi.fn() }));
vi.mock("../production/generateProductionObject", () => ({ generateProductionObject: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it("routes an unclear opening into implementation repair even when art and scripted journey pass", async () => {
  vi.mocked(renderReviewedJourney).mockResolvedValue({
    journey: {},
    rendered: {
      images: ["m", "ma", "d", "da"],
      report: ["mobile", "desktop"].map(name => ({
        name,
        journeyPassed: true,
        errors: [],
        overflow: false,
      })),
    },
  } as never);
  const opening = {
    verdict: "revise",
    observations: [],
    issues: [
      {
        severity: "blocking",
        module: "implementation",
        detail: "Cannot discover how to begin",
        fix: "Give the first action a visible cue",
      },
    ],
    summary: "Unclear entrance",
  };
  vi.mocked(reviewOpeningSequence).mockResolvedValue(opening as never);
  vi.mocked(generateProductionObject).mockResolvedValue({
    verdict: "pass",
    issues: [],
    summary: "Art passes",
  });
  const result = await reviewExperience(
    {} as SiteSnapshot,
    { contract: {} } as CreativeDirection,
    "account",
    "site",
  );
  expect(result.verdict).toBe("revise");
  expect(result.issues).toContainEqual(opening.issues[0]);
  expect(result.verification?.opening).toEqual(opening);
});
