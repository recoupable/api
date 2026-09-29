import { approvedConcept } from "./conceptFixture";
import { beforeEach, expect, it, vi } from "vitest";
import { selectExperienceConcept } from "../production/selectExperienceConcept";
import { produceSite } from "../production/produceSite";
import type { Site } from "../schema";
vi.mock("../skills/prepareSiteSkill", () => ({
  prepareSiteSkill: vi.fn(async () => ({
    name: "recoup-content-build-sites",
    revision: "pinned",
    referenceIds: [1, 2],
  })),
}));
vi.mock("../production/selectExperienceConcept", () => ({
  selectExperienceConcept: vi.fn().mockResolvedValue({ name: "Selected" }),
}));
const m = vi.hoisted(() => ({
  collect: vi.fn(),
  direct: vi.fn(),
  assets: vi.fn(),
  build: vi.fn(),
  review: vi.fn(),
}));
vi.mock("../production/collectReleaseContext", () => ({ collectReleaseContext: m.collect }));
vi.mock("../production/directExperience", () => ({ directExperience: m.direct }));
vi.mock("../production/produceAssets", () => ({ produceAssets: m.assets }));
vi.mock("../production/buildExperience", () => ({ buildExperience: m.build }));
vi.mock("../production/reviewExperience", () => ({ reviewExperience: m.review }));
const site = { id: "site", assets: [], draft: null } as unknown as Site;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(selectExperienceConcept).mockResolvedValue(approvedConcept);
  m.collect.mockResolvedValue({ music: { status: "unavailable" } });
  m.direct.mockResolvedValue({ concept: "A listening garden" });
  m.assets.mockResolvedValue([]);
  m.build.mockResolvedValue({ design: { headline: "Garden" } });
  m.review.mockResolvedValue({ verdict: "pass", issues: [] });
});
it("runs research, direction, real assets, implementation and review in order", async () => {
  const result = await produceSite(site, "", "account", "saved-brief", approvedConcept);
  expect(m.collect).toHaveBeenCalledWith(site, "account", "saved-brief");
  expect(m.direct).toHaveBeenCalledWith(site, "", expect.anything(), "account", approvedConcept);
  expect(m.build.mock.calls[0][3]).toEqual([]);
  expect(result.production.reviews).toHaveLength(1);
  expect(result.production.status).toBe("reviewed");
});
it("revises once with concrete review feedback and keeps both reviews", async () => {
  m.review.mockResolvedValueOnce({
    verdict: "revise",
    issues: [{ detail: "Mobile start button clipped" }],
  });
  const result = await produceSite(site, "", "account", "saved-brief", approvedConcept);
  expect(m.build).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(m.build.mock.calls[1])).toContain("Mobile start button clipped");
  expect(result.production.reviews).toHaveLength(2);
});
it("does not endlessly spend or label a failed review as approved", async () => {
  m.review.mockResolvedValue({ verdict: "revise", issues: [{ detail: "Unreadable" }] });
  const result = await produceSite(site, "", "account", "saved-brief", approvedConcept);
  expect(m.build).toHaveBeenCalledTimes(4);
  expect(result.production.context.siteSkill?.referenceIds).toEqual([1, 2]);
  expect(result.production.status).toBe("needs-review");
});
it("asset failures stop before code generation rather than inventing asset URLs", async () => {
  m.assets.mockRejectedValue(new Error("Image provider unavailable"));
  await expect(produceSite(site, "", "account", undefined, approvedConcept)).rejects.toThrow(
    "Image provider unavailable",
  );
  expect(m.build).not.toHaveBeenCalled();
});

it("routes asset feedback to asset production without changing direction", async () => {
  m.review.mockResolvedValueOnce({
    verdict: "revise",
    issues: [{ module: "assets", detail: "Blurry scene" }],
  });
  await produceSite(site, "", "account", undefined, approvedConcept);
  expect(m.assets).toHaveBeenCalledTimes(2);
  expect(m.direct).toHaveBeenCalledTimes(1);
  expect(m.assets.mock.calls[1][3]).toContain("Blurry scene");
});
it("keeps the selected activity and stops paid repair when concept review fails", async () => {
  m.review.mockResolvedValueOnce({
    verdict: "revise",
    issues: [{ module: "direction", detail: "No fan payoff" }],
  });
  const result = await produceSite(site, "", "account", undefined, approvedConcept);
  expect(m.direct).toHaveBeenCalledTimes(1);
  expect(m.assets).toHaveBeenCalledTimes(1);
  expect(m.build).toHaveBeenCalledTimes(1);
  expect(m.review).toHaveBeenCalledTimes(1);
  expect(result.production.status).toBe("needs-review");
});
it("selects a concept inside production when the client omits it", async () => {
  await produceSite(site, "", "account");
  expect(m.collect).toHaveBeenCalledOnce();
  expect(m.direct).toHaveBeenCalledWith(site, "", expect.anything(), "account", expect.anything());
});
