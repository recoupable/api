import { it, expect, vi } from "vitest";
import { siteProductionWorkflow } from "@/app/workflows/sites/siteProductionWorkflow";
import type { Site } from "../schema";
vi.mock("@/app/workflows/sites/ensureSiteExistsStep", () => ({
  ensureSiteExistsStep: vi.fn().mockResolvedValue(undefined),
}));
const m = vi.hoisted(() => ({
  albumMetadataStep: vi.fn(),
  metadataStep: vi.fn(),
  audioSourceStep: vi.fn(),
  audioAnalysisStep: vi.fn(),
  enrichContextStep: vi.fn(),
  contextBriefStep: vi.fn(),
  prepareSkillStep: vi.fn(),
  selectConceptStep: vi.fn(),
  directionStep: vi.fn(),
  revealBuildStep: vi.fn(),
  assetsStep: vi.fn(),
  buildStep: vi.fn(),
  reviewStep: vi.fn(),
  saveSiteStep: vi.fn(),
  reviseStep: vi.fn(),
  collectContextStep: vi.fn(),
}));
vi.mock("@/app/workflows/sites/albumMetadataStep", () => ({
  albumMetadataStep: m.albumMetadataStep,
}));
vi.mock("@/app/workflows/sites/metadataStep", () => ({ metadataStep: m.metadataStep }));
vi.mock("@/app/workflows/sites/audioSourceStep", () => ({ audioSourceStep: m.audioSourceStep }));
vi.mock("@/app/workflows/sites/audioAnalysisStep", () => ({
  audioAnalysisStep: m.audioAnalysisStep,
}));
vi.mock("@/app/workflows/sites/enrichContextStep", () => ({
  enrichContextStep: m.enrichContextStep,
}));
vi.mock("@/app/workflows/sites/contextBriefStep", () => ({ contextBriefStep: m.contextBriefStep }));
vi.mock("@/app/workflows/sites/prepareSkillStep", () => ({ prepareSkillStep: m.prepareSkillStep }));
vi.mock("@/app/workflows/sites/selectConceptStep", () => ({
  selectConceptStep: m.selectConceptStep,
}));
vi.mock("@/app/workflows/sites/directionStep", () => ({ directionStep: m.directionStep }));
vi.mock("@/app/workflows/sites/revealBuildStep", () => ({ revealBuildStep: m.revealBuildStep }));
vi.mock("@/app/workflows/sites/assetsStep", () => ({ assetsStep: m.assetsStep }));
vi.mock("@/app/workflows/sites/buildStep", () => ({ buildStep: m.buildStep }));
vi.mock("@/app/workflows/sites/reviewStep", () => ({ reviewStep: m.reviewStep }));
vi.mock("@/app/workflows/sites/saveSiteStep", () => ({ saveSiteStep: m.saveSiteStep }));
vi.mock("@/app/workflows/sites/reviseStep", () => ({ reviseStep: m.reviseStep }));
vi.mock("@/app/workflows/sites/collectContextStep", () => ({
  collectContextStep: m.collectContextStep,
}));
it("continues after unavailable album audio, skips dependent analysis, and saves attributed gaps", async () => {
  const release = {
    url: "https://open.spotify.com/album/album",
    title: "Album",
    artists: ["Artist"],
    artwork: null,
    date: null,
    isrc: null,
    previewUrl: null,
  };
  m.albumMetadataStep.mockResolvedValue({
    release,
    tracks: [{ url: "missing" }, { url: "working" }],
    gaps: [],
  });
  m.metadataStep.mockImplementation(async site => ({
    release: { ...release, url: site.release_url },
  }));
  m.audioSourceStep
    .mockResolvedValueOnce({
      status: "unavailable",
      reason: "No hosted audio passed recording verification",
    })
    .mockResolvedValueOnce({ status: "available" });
  m.contextBriefStep.mockImplementation(async site => ({
    release: { ...release, url: site.release_url, title: site.release_url },
    music: { status: "saved-analysis", coverage: "source-defined", analysis: "Saved analysis" },
    research: { status: "unavailable", sources: [] },
  }));
  m.directionStep.mockResolvedValue({ concept: "An album experience" });
  m.assetsStep.mockResolvedValue([]);
  m.revealBuildStep.mockResolvedValue(undefined);
  m.buildStep.mockResolvedValue({});
  m.reviewStep.mockResolvedValue({ verdict: "pass", issues: [] });
  m.saveSiteStep.mockImplementation(async (_site, snapshot) => snapshot);
  const result = (await siteProductionWorkflow(
    { id: "site", release_url: release.url } as Site,
    "Build",
    "account",
  )) as any;
  expect(m.audioAnalysisStep).toHaveBeenCalledTimes(2);
  expect(m.audioAnalysisStep.mock.calls.every(c => c[0].release_url === "working")).toBe(true);
  expect(m.enrichContextStep).toHaveBeenCalledTimes(4);
  expect(m.buildStep).toHaveBeenCalledOnce();
  expect(result.production.context.tracks).toHaveLength(2);
  expect(result.production.context.gaps.map((g: any) => g.topic)).toEqual([
    "audio_source",
    "lyrics",
    "song_summary",
  ]);
  expect(result.production.context.tracks[0].music.status).toBe("unavailable");
});
