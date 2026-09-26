import { expect, it, vi } from "vitest";
import { actionSchema } from "../schema";
import { siteOperationSchemas } from "../siteOperationSchemas";
import { proposeExperienceConcepts } from "../production/proposeExperienceConcepts";
import { generateProductionObject } from "../production/generateProductionObject";
import type { Site } from "../schema";
import type { ReleaseContext } from "../production/schema";
vi.mock("../production/generateProductionObject", () => ({ generateProductionObject: vi.fn() }));
it("requires an explicitly selected concept on both generation transports", () => {
  const input = { revision: 0 };
  expect(actionSchema.safeParse({ ...input, action: "generate" }).success).toBe(false);
  expect(
    siteOperationSchemas.generate.safeParse({
      ...input,
      id: "11111111-1111-4111-8111-111111111111",
    }).success,
  ).toBe(false);
});
it("returns no concepts without song understanding or artist context and does not spend", async () => {
  vi.mocked(generateProductionObject).mockClear();
  const result = await proposeExperienceConcepts(
    { assets: [] } as unknown as Site,
    "",
    {
      music: { status: "unavailable", analysis: "", coverage: "none" },
      research: { status: "unavailable", sources: [] },
    } as unknown as ReleaseContext,
    "account",
  );
  expect(result.status).toBe("needs-context");
  expect(result.candidates).toEqual([]);
  expect(generateProductionObject).not.toHaveBeenCalled();
});

it("allows the model to return no good concept even with usable context", async () => {
  vi.mocked(generateProductionObject).mockResolvedValueOnce({
    status: "no-good-concept",
    candidates: [],
    reason: "No compelling fan activity yet.",
  });
  const result = await proposeExperienceConcepts(
    { assets: [], brief: "" } as unknown as Site,
    "",
    {
      music: { status: "analyzed", analysis: "A song situation", coverage: "preview" },
      research: { status: "unavailable", sources: [] },
    } as unknown as ReleaseContext,
    "account",
  );
  expect(result.status).toBe("no-good-concept");
  expect(result.candidates).toEqual([]);
});
