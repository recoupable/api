import { approvedConcept } from "./conceptFixture";
import { expect, it, vi, beforeEach } from "vitest";
import { directExperience } from "../production/directExperience";
import { generateProductionObject } from "../production/generateProductionObject";
import type { Site } from "../schema";
import type { ReleaseContext } from "../production/schema";
vi.mock("../production/generateProductionObject", () => ({ generateProductionObject: vi.fn() }));
vi.mock("@/lib/supabase/sites/selectSiteAssetOutcomes", () => ({
  selectSiteAssetOutcomes: vi.fn(async () => []),
}));
const direction = {
  assets: [],
  candidates: [{ name: "One" }],
  selectedIndex: 0,
  contract: {
    releaseConnection: "An explicit connection to the documented release story.",
    evidence: ["A supplied source"],
    motivation: "Replay the challenge to master the ending.",
    payoff: "A completed interactive ending with replay.",
    capabilities: ["browser-interaction"],
    steps: [
      {
        action: "click",
        target: "Start",
        value: "",
        expected: "Choose",
        checkpoint: "participate",
      },
      { action: "click", target: "Finish", value: "", expected: "Ending", checkpoint: "result" },
      { action: "click", target: "Replay", value: "", expected: "Choose", checkpoint: "delivery" },
    ],
  },
};
beforeEach(() => vi.resetAllMocks());
const rejected = {
  followsSelection: true,
  releaseConnection: false,
  fanValue: false,
  feasible: true,
  completeJourney: true,
  reason: "Arbitrary reward unrelated to song",
};

it("rejects a director rationale that the independent reviewer finds arbitrary", async () => {
  vi.mocked(generateProductionObject)
    .mockResolvedValueOnce(direction)
    .mockResolvedValueOnce({
      followsSelection: true,
      releaseConnection: false,
      fanValue: false,
      feasible: true,
      completeJourney: true,
      reason: "Arbitrary reward unrelated to song",
    })
    .mockResolvedValueOnce(direction)
    .mockResolvedValueOnce(rejected);
  await expect(
    directExperience(
      { id: "site", assets: [] } as unknown as Site,
      "",
      {} as ReleaseContext,
      "account",
      approvedConcept,
    ),
  ).rejects.toThrow("Arbitrary reward");
});
it("returns the original direction only after all concept checks pass", async () => {
  vi.mocked(generateProductionObject).mockResolvedValueOnce(direction).mockResolvedValueOnce({
    followsSelection: true,
    releaseConnection: true,
    fanValue: true,
    feasible: true,
    completeJourney: true,
    reason: "Grounded and playable",
  });
  const result = await directExperience(
    { id: "site", assets: [] } as unknown as Site,
    "",
    {} as ReleaseContext,
    "account",
    approvedConcept,
  );
  expect(result.selectedIndex).toBe(0);
  expect(generateProductionObject).toHaveBeenCalledTimes(2);
});

it("rejects a plan that replaces the customer-selected activity", async () => {
  vi.mocked(generateProductionObject)
    .mockResolvedValueOnce(direction)
    .mockResolvedValueOnce({
      followsSelection: false,
      releaseConnection: true,
      fanValue: true,
      feasible: true,
      completeJourney: true,
      reason: "Changed the selected activity",
    })
    .mockResolvedValueOnce(direction)
    .mockResolvedValueOnce({
      ...rejected,
      followsSelection: false,
      reason: "Changed the selected activity",
    });
  await expect(
    directExperience(
      { id: "site", assets: [] } as unknown as Site,
      "",
      {} as ReleaseContext,
      "account",
      approvedConcept,
    ),
  ).rejects.toThrow("Changed the selected activity");
});

it("revises a rejected plan using reviewer feedback and independently checks it again", async () => {
  const passed = {
    ...rejected,
    releaseConnection: true,
    fanValue: true,
    reason: "Grounded and playable",
  };
  vi.mocked(generateProductionObject)
    .mockResolvedValueOnce(direction)
    .mockResolvedValueOnce(rejected)
    .mockResolvedValueOnce(direction)
    .mockResolvedValueOnce(passed);
  await directExperience(
    { id: "site", assets: [] } as unknown as Site,
    "",
    {} as ReleaseContext,
    "account",
    approvedConcept,
  );
  expect(generateProductionObject).toHaveBeenCalledTimes(4);
  expect(vi.mocked(generateProductionObject).mock.calls[2][2]).toMatchObject({
    revision: { assessment: rejected, direction },
  });
});

it("requires an opening plan in newly generated directions", async () => {
  vi.mocked(generateProductionObject).mockResolvedValueOnce(direction).mockResolvedValueOnce({
    followsSelection: true,
    releaseConnection: true,
    fanValue: true,
    feasible: true,
    completeJourney: true,
    reason: "Playable",
  });
  await directExperience(
    { id: "site", assets: [] } as unknown as Site,
    "",
    {} as ReleaseContext,
    "account",
    approvedConcept,
  );
  const schema = vi.mocked(generateProductionObject).mock.calls[0][0];
  expect(schema.safeParse(direction).success).toBe(false);
  // The opening field itself must be required even though saved legacy directions may omit it.
  expect(
    (schema as typeof import("../production/schema").directionSchema).shape.opening.safeParse(
      undefined,
    ).success,
  ).toBe(false);
});
