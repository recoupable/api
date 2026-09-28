import { beforeEach, expect, it, vi } from "vitest";
import { selectExperienceConcept } from "../production/selectExperienceConcept";
import { proposeExperienceConcepts } from "../production/proposeExperienceConcepts";
import { generateProductionObject } from "../production/generateProductionObject";
import { approvedConcept } from "./conceptFixture";
import type { Site } from "../schema";
import type { ReleaseContext } from "../production/schema";
vi.mock("../production/proposeExperienceConcepts", () => ({ proposeExperienceConcepts: vi.fn() }));
vi.mock("../production/generateProductionObject", () => ({ generateProductionObject: vi.fn() }));
const site = { id: "site" } as Site;
const context = {} as ReleaseContext;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(proposeExperienceConcepts).mockResolvedValue({
    status: "ready",
    candidates: [approvedConcept],
    reason: "",
  });
});
it("judges even a single candidate instead of automatically accepting it", async () => {
  vi.mocked(generateProductionObject).mockResolvedValue({
    index: 0,
    accepted: true,
    reason: "Concrete entertaining payoff",
  });
  expect(await selectExperienceConcept(site, "", context, "account")).toEqual(approvedConcept);
  expect(generateProductionObject).toHaveBeenCalledTimes(1);
});
it("uses rejection feedback for one bounded repitch", async () => {
  vi.mocked(generateProductionObject)
    .mockResolvedValueOnce({ index: 0, accepted: false, reason: "Choices change only a caption" })
    .mockResolvedValueOnce({ index: 0, accepted: true, reason: "Distinct outcomes" });
  await selectExperienceConcept(site, "", context, "account");
  expect(proposeExperienceConcepts).toHaveBeenLastCalledWith(
    site,
    "",
    context,
    "account",
    "Choices change only a caption",
  );
});
it("stops before asset spending when the second proposal is also weak", async () => {
  vi.mocked(generateProductionObject).mockResolvedValue({
    index: 0,
    accepted: false,
    reason: "No worthwhile payoff",
  });
  await expect(selectExperienceConcept(site, "", context, "account")).rejects.toThrow(
    "No worthwhile payoff",
  );
  expect(proposeExperienceConcepts).toHaveBeenCalledTimes(2);
});
