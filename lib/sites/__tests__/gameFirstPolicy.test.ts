import { expect, it, vi } from "vitest";
import { selectExperienceConcept } from "../production/selectExperienceConcept";
import { prepareBuildInput } from "../production/prepareBuildInput";
import { generateProductionObject } from "../production/generateProductionObject";
import type { Site } from "../schema";
import type { CreativeDirection, ReleaseContext } from "../production/schema";
vi.mock("../production/generateProductionObject", () => ({ generateProductionObject: vi.fn() }));
const site = { id: "site", brief: "Create a fan site", assets: [] } as unknown as Site;
const context = {
  music: { status: "analyzed", analysis: "An energetic song about escape" },
  research: { status: "unavailable", sources: [] },
} as unknown as ReleaseContext;
it("carries game-first criteria and explicit format requests through proposal and selection", async () => {
  const candidates = [{ activity: "A flight challenge" }, { activity: "A puzzle" }];
  vi.mocked(generateProductionObject).mockReset();
  vi.mocked(generateProductionObject)
    .mockResolvedValueOnce({ status: "ready", candidates })
    .mockResolvedValueOnce({ index: 1, reason: "Matches the request" });
  const instruction = "Make a quiet puzzle with no timer";
  expect(await selectExperienceConcept(site, instruction, context, "account")).toEqual(
    candidates[1],
  );
  const calls = vi.mocked(generateProductionObject).mock.calls;
  for (const call of calls) expect(call[1]).toContain("Default to a short, replayable game");
  expect(calls[1][2]).toMatchObject({ instruction, brief: site.brief });
});
it("passes the same gameplay policy to implementation alongside the selected contract", () => {
  const direction = { contract: { payoff: "Solve the puzzle" } } as CreativeDirection;
  const input = prepareBuildInput(site, "", { release: context, direction }, [], "account");
  const brief = JSON.parse(input.instruction);
  expect(brief.gameplayCriteria).toContain("Default to a short, replayable game");
  expect(brief.fanJourneyContract).toEqual(direction.contract);
});
