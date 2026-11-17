import { albumMetadataStep } from "@/app/workflows/sites/albumMetadataStep";
import { revealBuildStep } from "@/app/workflows/sites/revealBuildStep";
import { reviewStep } from "@/app/workflows/sites/reviewStep";
import { prepareSkillStep } from "@/app/workflows/sites/prepareSkillStep";
import { directionStep } from "@/app/workflows/sites/directionStep";
import { assetsStep } from "@/app/workflows/sites/assetsStep";
import { approvedConcept } from "./conceptFixture";
import { beforeEach, expect, it, vi } from "vitest";
import { siteProductionWorkflow } from "@/app/workflows/sites/siteProductionWorkflow";
import type { Site } from "../schema";
vi.mock("@/app/workflows/sites/ensureSiteExistsStep", () => ({
  ensureSiteExistsStep: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/workflows/sites/revealBuildStep", () => ({
  revealBuildStep: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/workflows/sites/prepareSkillStep", () => ({
  prepareSkillStep: vi.fn(async () => ({
    name: "recoup-content-build-sites",
    referenceIds: [1, 2],
  })),
}));
vi.mock("@/app/workflows/sites/albumMetadataStep", () => ({ albumMetadataStep: vi.fn() }));
const m = vi.hoisted(() => ({
  checkpoint: vi.fn(),
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
vi.mock("@/app/workflows/sites/readRepairCheckpointStep", () => ({
  readRepairCheckpointStep: m.checkpoint,
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
  m.checkpoint.mockReset().mockImplementation(async (site: Site) => ({
    revision: site.revision,
    cancelled: false,
    now: 1000,
  }));
  vi.mocked(reviewStep)
    .mockReset()
    .mockResolvedValue({ verdict: "pass", issues: [] } as never);
  m.metadata.mockResolvedValue({ requestId: "request" });
  m.audio.mockResolvedValue({ status: "available" });
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

it("stops when the review after the second repair still requests revision", async () => {
  for (let i = 0; i < 6; i++)
    vi.mocked(reviewStep).mockResolvedValueOnce({
      verdict: "revise",
      issues: [{ module: "implementation", detail: `Fix ${i}` }],
    } as never);
  m.revise.mockResolvedValue({ snapshot: {}, direction: {}, assets: [] });
  const result = await siteProductionWorkflow(
    { id: "site" } as Site,
    "",
    "account",
    undefined,
    approvedConcept,
  );
  expect(result).toEqual({ error: expect.stringContaining("repair attempt limit") });
  expect(m.revise).toHaveBeenCalledTimes(2);
  expect(reviewStep).toHaveBeenCalledTimes(3);
  expect(m.save).not.toHaveBeenCalled();
});
it.each(["late pass", "deleted", "revision", "access", "slow repair"])(
  "preserves saved state after %s",
  async scenario => {
    const site = { id: "site", revision: 7 } as Site;
    vi.mocked(reviewStep).mockResolvedValueOnce({
      verdict: "revise",
      issues: [{ module: "implementation", detail: "Fix" }],
    } as never);
    m.revise.mockResolvedValue({ snapshot: {}, direction: {}, assets: [] });
    let checks = 0;
    m.checkpoint.mockImplementation(async () => {
      checks++;
      const changed = checks >= (scenario === "late pass" ? 5 : scenario === "slow repair" ? 3 : 2);
      if (changed && scenario === "access") throw new Error("Access revoked");
      return {
        revision: changed && scenario === "revision" ? 8 : 7,
        cancelled: changed && scenario === "deleted",
        now: changed && ["late pass", "slow repair"].includes(scenario) ? 1201000 : 1000,
      };
    });
    expect(
      await siteProductionWorkflow(site, "", "account", undefined, approvedConcept),
    ).toHaveProperty("error");
    expect(m.save).not.toHaveBeenCalled();
    expect(m.revise).toHaveBeenCalledTimes(["late pass", "slow repair"].includes(scenario) ? 1 : 0);
    expect(reviewStep).toHaveBeenCalledTimes(scenario === "late pass" ? 2 : 1);
  },
);
it("accepts a repaired pass and carries the original context and assets", async () => {
  vi.mocked(reviewStep).mockResolvedValueOnce({
    verdict: "revise",
    issues: [{ module: "implementation" }],
  } as never);
  const candidate = { name: "Repaired" };
  m.revise.mockImplementation(async (_s, _i, _c, direction, assets) => ({
    snapshot: candidate,
    direction,
    assets,
  }));
  await siteProductionWorkflow(
    { id: "site" } as Site,
    "Keep game",
    "account",
    undefined,
    approvedConcept,
  );
  expect(m.save).toHaveBeenCalledOnce();
  expect(m.save.mock.calls[0][1].production.reviews).toHaveLength(2);
  expect(m.revise.mock.calls[0][2]).toEqual(m.build.mock.calls[0][2].release);
  expect(m.revise.mock.calls[0][4]).toEqual(m.build.mock.calls[0][3]);
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
    error: "Site production stopped during bounded repair. Your existing draft is unchanged.",
  });
  expect(m.save).not.toHaveBeenCalled();
});

it("keeps building when a customer-facing milestone fails", async () => {
  vi.mocked(revealBuildStep).mockRejectedValueOnce(new Error("Milestone unavailable"));
  await siteProductionWorkflow({ id: "site" } as Site, "", "account", undefined, approvedConcept);
  expect(m.save).toHaveBeenCalledOnce();
});

it("analyzes every album track with durable steps and hands album evidence to the builder", async () => {
  const release = {
    url: "https://open.spotify.com/album/3Mqw7mOaxxoxCA7e7oBtil",
    title: "Album",
    artists: ["Artist"],
    artwork: null,
    date: null,
    isrc: null,
    previewUrl: null,
  };
  const urls = [
    "https://open.spotify.com/track/0I0XxqOsh8fEUP6Q5kii2f",
    "https://open.spotify.com/track/4bbDlzPasNSFI1l69mx2zx",
  ];
  vi.mocked(albumMetadataStep).mockResolvedValue({
    release,
    tracks: urls.map((url, i) => ({
      url,
      id: url.split("/").at(-1)!,
      name: `Song ${i}`,
      disc_number: 1,
      track_number: i + 1,
    })),
    gaps: [],
  });
  m.brief.mockImplementation(async (trackSite: Site) => ({
    release: { ...release, url: trackSite.release_url },
    music: { status: "saved-analysis", analysis: "Verified sound" },
    research: { status: "unavailable", sources: [] },
  }));
  await siteProductionWorkflow({ id: "site", release_url: release.url } as Site, "", "account");
  expect(m.metadata.mock.calls.map(call => [call[0].release_url, call[2]])).toEqual(
    urls.map(url => [url, true]),
  );
  expect(m.audio).toHaveBeenCalledTimes(2);
  expect(m.analyze.mock.calls.map(call => [call[0].release_url, call[3]])).toEqual(
    urls.flatMap(url => [
      [url, "lyrics"],
      [url, "summary"],
    ]),
  );
  expect(m.brief).toHaveBeenCalledTimes(2);
  expect(m.build.mock.calls[0][2].release.release.url).toBe(release.url);
  expect(m.build.mock.calls[0][2].release.tracks).toHaveLength(2);
});

it("preserves the saved draft on a credit-blocked review without starting paid repairs", async () => {
  const review = {
    verdict: "revise" as const,
    blocked: "credits" as const,
    issues: [],
    summary: "Add credits to finish review.",
  };
  vi.mocked(reviewStep).mockResolvedValue(review);
  m.build.mockResolvedValue({ name: "Saved game" });
  m.save.mockResolvedValue({ site: { id: "site" } });
  const result = await siteProductionWorkflow(
    { id: "site" } as Site,
    "",
    "account",
    undefined,
    approvedConcept,
  );
  expect(result).toEqual({ error: expect.stringContaining("credit limit") });
  expect(m.revise).not.toHaveBeenCalled();
  expect(m.save).not.toHaveBeenCalled();
});

it.each(["revise", "pass"])(
  "saves direction rejection as needs-review with a %s verdict",
  async verdict => {
    vi.mocked(reviewStep).mockResolvedValueOnce({
      verdict,
      issues: [{ module: "direction", detail: "Wrong concept" }],
    } as never);
    await siteProductionWorkflow({ id: "site" } as Site, "", "account", undefined, approvedConcept);
    expect(m.save).toHaveBeenCalledOnce();
    expect(m.save.mock.calls[0][1].production.status).toBe("needs-review");
    expect(m.revise).not.toHaveBeenCalled();
  },
);
it.each(["revision", "deleted", "access"])(
  "stops %s after a completed durable repair without review or save",
  async change => {
    const site = { id: "site", revision: 7 } as Site;
    vi.mocked(reviewStep).mockResolvedValueOnce({
      verdict: "revise",
      issues: [{ module: "implementation", detail: "Fix" }],
    } as never);
    m.revise.mockResolvedValue({ snapshot: {}, direction: {}, assets: [] });
    let checks = 0;
    m.checkpoint.mockImplementation(async () => {
      const changed = ++checks >= 3;
      if (changed && change === "access") throw new Error("Access revoked");
      return {
        revision: changed && change === "revision" ? 8 : 7,
        cancelled: changed && change === "deleted",
        now: 1000,
      };
    });
    expect(
      await siteProductionWorkflow(site, "", "account", undefined, approvedConcept),
    ).toHaveProperty("error");
    expect(m.revise).toHaveBeenCalledOnce();
    expect(reviewStep).toHaveBeenCalledOnce();
    expect(m.save).not.toHaveBeenCalled();
  },
);

it.each(["revision", "deleted"])(
  "does not claim external state is unchanged after durable %s stop",
  async change => {
    m.checkpoint.mockResolvedValue({
      revision: change === "revision" ? 8 : 7,
      cancelled: change === "deleted",
      now: 1000,
    });
    const result = await siteProductionWorkflow(
      { id: "site", revision: 7 } as Site,
      "",
      "account",
      undefined,
      approvedConcept,
    );
    expect(result).toEqual({
      error: expect.stringContaining("This run did not save its candidate."),
    });
    expect(result).toEqual({ error: expect.not.stringContaining("unchanged") });
    expect(m.save).not.toHaveBeenCalled();
  },
);

it("accepts a pass from the second and final allowed repair", async () => {
  const revise = {
    verdict: "revise",
    issues: [{ module: "implementation", detail: "Fix" }],
  } as never;
  vi.mocked(reviewStep).mockResolvedValueOnce(revise).mockResolvedValueOnce(revise);
  m.revise.mockResolvedValue({ snapshot: {}, direction: {}, assets: [] });
  await siteProductionWorkflow({ id: "site" } as Site, "", "account", undefined, approvedConcept);
  expect(m.revise).toHaveBeenCalledTimes(2);
  expect(reviewStep).toHaveBeenCalledTimes(3);
  expect(m.save).toHaveBeenCalledOnce();
  expect(m.save.mock.calls[0][1].production.status).toBe("reviewed");
});
it.each(["expired", "deleted", "revision"])(
  "does not reveal a repaired candidate after %s control change",
  async change => {
    vi.mocked(reviewStep).mockResolvedValueOnce({
      verdict: "revise",
      issues: [{ module: "implementation", detail: "Fix" }],
    } as never);
    const candidate = { name: "Repaired candidate" };
    m.revise.mockResolvedValue({ snapshot: candidate, direction: {}, assets: [] });
    let reads = 0;
    m.checkpoint.mockImplementation(async () => ({
      revision: ++reads >= 3 && change === "revision" ? 8 : 7,
      cancelled: reads >= 3 && change === "deleted",
      now: reads >= 3 && change === "expired" ? 1201000 : 1000,
    }));
    expect(
      await siteProductionWorkflow(
        { id: "site", revision: 7 } as Site,
        "",
        "account",
        undefined,
        approvedConcept,
      ),
    ).toHaveProperty("error");
    expect(m.revise).toHaveBeenCalledOnce();
    expect(vi.mocked(revealBuildStep).mock.calls.some(call => call[2] === candidate)).toBe(false);
    expect(reviewStep).toHaveBeenCalledOnce();
    expect(m.save).not.toHaveBeenCalled();
  },
);

it("rechecks the deadline after revealing a repaired candidate before paid review", async () => {
  vi.mocked(reviewStep).mockResolvedValueOnce({
    verdict: "revise",
    issues: [{ module: "implementation", detail: "Fix" }],
  } as never);
  const candidate = { name: "Repaired" };
  m.revise.mockResolvedValue({ snapshot: candidate, direction: {}, assets: [] });
  let now = 1000;
  m.checkpoint.mockImplementation(async () => ({ revision: 7, cancelled: false, now }));
  vi.mocked(revealBuildStep).mockImplementation(async (_d, _a, snapshot) => {
    if (snapshot === candidate) now = 1201000;
    return { concept: _d, assets: _a };
  });
  const result = await siteProductionWorkflow(
    { id: "site", revision: 7 } as Site,
    "",
    "account",
    undefined,
    approvedConcept,
  );
  expect(result).toEqual({ error: expect.stringContaining("repair time limit") });
  expect(reviewStep).toHaveBeenCalledOnce();
  expect(m.save).not.toHaveBeenCalled();
});
