import { beforeEach, expect, it, vi } from "vitest";
import { renderReviewedJourney } from "../production/renderReviewedJourney";
import { compileJourney } from "../production/compileJourney";
import { renderExperience } from "../production/renderExperience";
import type { SiteSnapshot } from "../schema";
import type { ExperienceContract } from "../production/experienceContract";
vi.mock("../production/compileJourney", () => ({ compileJourney: vi.fn() }));
vi.mock("../production/renderExperience", () => ({ renderExperience: vi.fn() }));
const snapshot = {} as SiteSnapshot;
const contract = { payoff: "Complete the routine" } as ExperienceContract;
const failed = {
  report: [{ journeyPassed: false, errors: ["Expected recording; page shows frozen"] }],
  images: [],
} as unknown as Awaited<ReturnType<typeof renderExperience>>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(compileJourney).mockResolvedValue(contract);
});
it("repairs the test once using browser evidence without changing the site or payoff", async () => {
  vi.mocked(renderExperience)
    .mockResolvedValueOnce(failed)
    .mockResolvedValueOnce({ report: [], images: [], firstActionImages: [] });
  await renderReviewedJourney(snapshot, contract, "account", "site");
  expect(compileJourney).toHaveBeenLastCalledWith(snapshot, contract, "account", "site", {
    journey: contract,
    reports: failed.report,
  });
  expect(renderExperience).toHaveBeenNthCalledWith(2, snapshot, contract);
});
it("retains failed evidence after the bounded repair instead of claiming success", async () => {
  vi.mocked(renderExperience).mockResolvedValue(failed);
  const result = await renderReviewedJourney(snapshot, contract, "account", "site");
  expect(renderExperience).toHaveBeenCalledTimes(2);
  expect(result.rendered).toEqual(failed);
});
it("does not repeat a passing playthrough", async () => {
  const passed = {
    report: [{ journeyPassed: true, errors: [] }],
    images: [],
  } as unknown as typeof failed;
  vi.mocked(renderExperience).mockResolvedValue(passed);
  await renderReviewedJourney(snapshot, contract, "account", "site");
  expect(renderExperience).toHaveBeenCalledOnce();
});
