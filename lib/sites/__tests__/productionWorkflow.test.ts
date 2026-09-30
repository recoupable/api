import { revealBuildStep } from "@/app/workflows/sites/revealBuildStep";
import { reviewStep } from "@/app/workflows/sites/reviewStep";
import { prepareSkillStep } from "@/app/workflows/sites/prepareSkillStep";
import { directionStep } from "@/app/workflows/sites/directionStep";
import { assetsStep } from "@/app/workflows/sites/assetsStep";
import { approvedConcept } from "./conceptFixture";
import { beforeEach, expect, it, vi } from "vitest";
import { siteProductionWorkflow } from "@/app/workflows/sites/siteProductionWorkflow";
import type { Site } from "../schema";
vi.mock("@/app/workflows/sites/revealBuildStep", () => ({
  revealBuildStep: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/workflows/sites/prepareSkillStep", () => ({
  prepareSkillStep: vi.fn(async () => ({
    name: "recoup-content-build-sites",
    referenceIds: [1, 2],
  })),
}));
const m = vi.hoisted(() => ({
  build: vi.fn(),
  save: vi.fn(),
  revise: vi.fn(),
  metadata: vi.fn(),
  audio: vi.fn(),
  analyze: vi.fn(),
  enrich: vi.fn(),
  brief: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@/app/workflows/sites/metadataStep", () => ({ metadataStep: m.metadata }));
vi.mock("@/app/workflows/sites/audioSourceStep", () => ({ audioSourceStep: m.audio }));
vi.mock("@/app/workflows/sites/audioAnalysisStep", () => ({ audioAnalysisStep: m.analyze }));
vi.mock("@/app/workflows/sites/enrichContextStep", () => ({ enrichContextStep: m.enrich }));
vi.mock("@/app/workflows/sites/contextBriefStep", () => ({ contextBriefStep: m.brief }));
vi.mock("@/app/workflows/sites/selectConceptStep", () => ({ selectConceptStep: m.select }));
vi.mock("@/app/workflows/sites/collectContextStep", () => ({
  collectContextStep: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/app/workflows/sites/directionStep", () => ({
  directionStep: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/app/workflows/sites/assetsStep", () => ({ assetsStep: vi.fn().mockResolvedValue([]) }));
vi.mock("@/app/workflows/sites/buildStep", () => ({ buildStep: m.build }));
vi.mock("@/app/workflows/sites/reviewStep", () => ({
  reviewStep: vi.fn().mockResolvedValue({ verdict: "pass" }),
}));
vi.mock("@/app/workflows/sites/reviseStep", () => ({ reviseStep: m.revise }));
vi.mock("@/app/workflows/sites/saveSiteStep", () => ({ saveSiteStep: m.save }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reviewStep)
    .mockReset()
    .mockResolvedValue({ verdict: "pass", issues: [] } as never);
  m.metadata.mockResolvedValue({ requestId: "request" });
  m.audio.mockResolvedValue({});
  m.brief.mockResolvedValue({});
  m.select.mockResolvedValue(approvedConcept);
  m.build.mockResolvedValue({});
  m.save.mockResolvedValue({ site: {} });
});
it("returns an explicit failure without saving when a stage fails", async () => {
  m.build.mockRejectedValue(new Error("Provider failure"));
  const result = await siteProductionWorkflow(
    { id: "site" } as Site,
    "",
    "account",
    undefined,
    approvedConcept,
  );
  expect(result).toHaveProperty("error");
  expect(m.save).not.toHaveBeenCalled();
  expect(m.revise).not.toHaveBeenCalled();
});
it("saves the reviewed candidate as a draft", async () => {
  await siteProductionWorkflow({ id: "site" } as Site, "", "account", undefined, approvedConcept);
  expect(m.save.mock.calls[0][1].production.status).toBe("reviewed");
});

it("reports a save conflict without leaving the job running", async () => {
  m.save.mockRejectedValue(new Error("Newer revision exists"));
  expect(
    await siteProductionWorkflow({ id: "site" } as Site, "", "account", undefined, approvedConcept),
  ).toHaveProperty("error");
});

it("runs the entire saved-context path from a Spotify URL without caller selection", async () => {
  const site = {
    id: "site",
    release_url: "https://open.spotify.com/track/4bbDlzPasNSFI1l69mx2zx",
  } as Site;
  await siteProductionWorkflow(site, "", "account");
  expect(m.metadata).toHaveBeenCalledOnce();
  expect(m.audio).toHaveBeenCalledOnce();
  expect(m.analyze.mock.calls.map(c => c[3])).toEqual(["lyrics", "summary"]);
  expect(m.enrich.mock.calls.map(c => c[3])).toEqual(["artwork_branding", "artist_research"]);
  expect(m.brief).toHaveBeenCalledOnce();
  expect(m.select).toHaveBeenCalledOnce();
  expect(m.save).toHaveBeenCalledOnce();
  expect(m.audio.mock.invocationCallOrder[0]).toBeLessThan(m.analyze.mock.invocationCallOrder[0]);
});
it("names the failed context stage and never starts creative work after acquisition failure", async () => {
  m.audio.mockRejectedValueOnce(new Error("No verified source"));
  const result = await siteProductionWorkflow(
    { id: "site", release_url: "https://open.spotify.com/track/4bbDlzPasNSFI1l69mx2zx" } as Site,
    "",
    "account",
  );
  expect(result).toMatchObject({ error: expect.stringContaining("audio acquisition") });
  expect(m.analyze).not.toHaveBeenCalled();
  expect(m.select).not.toHaveBeenCalled();
  expect(m.build).not.toHaveBeenCalled();
  expect(m.save).not.toHaveBeenCalled();
});

it("repairs an existing draft without restarting concept selection or asset generation", async () => {
  const direction = { concept: "Existing moonwalk" };
  const assets = [{ url: "https://example.com/art.png" }];
  const site = {
    id: "site",
    draft: { assets, production: { context: {}, direction } },
  } as unknown as Site;
  await siteProductionWorkflow(site, "Repair the replay", "account");
  expect(prepareSkillStep).toHaveBeenCalledWith(
    expect.objectContaining({ currentExperience: direction }),
    "account",
    "site",
  );
  expect(m.select).not.toHaveBeenCalled();
  expect(directionStep).not.toHaveBeenCalled();
  expect(assetsStep).not.toHaveBeenCalled();
  expect(m.build).toHaveBeenCalledWith(
    site,
    "Repair the replay",
    expect.objectContaining({ direction }),
    assets,
    "account",
  );
  expect(m.save.mock.calls[0][1].production.direction).toEqual(direction);
});
it("uses an explicitly selected new concept even when a draft exists", async () => {
  const site = {
    id: "site",
    draft: { assets: [], production: { context: {}, direction: { concept: "Old" } } },
  } as unknown as Site;
  await siteProductionWorkflow(site, "Change concept", "account", undefined, approvedConcept);
  expect(directionStep).toHaveBeenCalledWith(
    site,
    "Change concept",
    expect.anything(),
    "account",
    approvedConcept,
  );
  expect(assetsStep).toHaveBeenCalledOnce();
});

it("commissions an explicit art revision without changing the existing game contract", async () => {
  const direction = {
    concept: "Existing moonwalk",
    contract: { activity: "choreograph" },
    assets: [],
  };
  const revisedAssets = [
    {
      name: "stage",
      prompt: "tactile moon",
      purpose: "stage",
      aspectRatio: "16:9",
      production: { model: "nano-banana-pro", rationale: "Tactile character artwork" },
    },
  ];
  vi.mocked(prepareSkillStep).mockResolvedValueOnce({ assetRevision: revisedAssets } as never);
  const site = {
    id: "site",
    draft: { assets: [], production: { context: {}, direction } },
  } as unknown as Site;
  await siteProductionWorkflow(site, "Replace the art", "account");
  expect(m.select).not.toHaveBeenCalled();
  expect(directionStep).not.toHaveBeenCalled();
  expect(assetsStep).toHaveBeenCalledWith(site, { ...direction, assets: revisedAssets }, "account");
  expect(m.build.mock.calls[0][2].direction.contract).toEqual(direction.contract);
});

it("explains build output exhaustion without exposing provider content or saving", async () => {
  m.build.mockRejectedValue(new Error("SITE_BUILD_OUTPUT_LIMIT"));
  const result = await siteProductionWorkflow(
    { id: "site" } as Site,
    "",
    "account",
    undefined,
    approvedConcept,
  );
  expect(result).toHaveProperty(
    "error",
    "The site builder reached its generation limit before finishing the code. Your saved draft is unchanged.",
  );
  expect(m.save).not.toHaveBeenCalled();
});

it("continues durable repairs beyond four reviews and saves only after passing", async () => {
  for (let i = 0; i < 6; i++)
    vi.mocked(reviewStep).mockResolvedValueOnce({
      verdict: "revise",
      issues: [{ module: "implementation", detail: `Fix ${i}` }],
    } as never);
  m.revise.mockResolvedValue({ snapshot: {}, direction: {}, assets: [] });
  await siteProductionWorkflow({ id: "site" } as Site, "", "account", undefined, approvedConcept);
  expect(m.revise).toHaveBeenCalledTimes(6);
  expect(reviewStep).toHaveBeenCalledTimes(7);
  expect(m.save).toHaveBeenCalledOnce();
  expect(m.save.mock.calls[0][1].production.status).toBe("reviewed");
  expect(m.save.mock.calls[0][1].production.reviews).toHaveLength(7);
  for (let i = 0; i < 6; i++) expect(m.revise.mock.calls[i][6].issues[0].detail).toBe(`Fix ${i}`);
});
it("reports a repair failure without saving an unfinished candidate", async () => {
  vi.mocked(reviewStep).mockResolvedValueOnce({
    verdict: "revise",
    issues: [{ module: "implementation", detail: "Font missing" }],
  } as never);
  m.revise.mockRejectedValueOnce(new Error("Provider unavailable"));
  const result = await siteProductionWorkflow(
    { id: "site" } as Site,
    "",
    "account",
    undefined,
    approvedConcept,
  );
  expect(result).toEqual({
    error:
      "Site production stopped during implementation repair. Your existing draft is unchanged.",
  });
  expect(m.save).not.toHaveBeenCalled();
});

it("keeps building when a customer-facing milestone fails", async () => {
  vi.mocked(revealBuildStep).mockRejectedValueOnce(new Error("Milestone unavailable"));
  await siteProductionWorkflow({ id: "site" } as Site, "", "account", undefined, approvedConcept);
  expect(m.save).toHaveBeenCalledOnce();
});
