import { beforeEach, expect, it, vi } from "vitest";
import { analyzeReleaseMusic } from "../production/analyzeReleaseMusic";
import { researchArtist } from "../production/researchArtist";
import { directExperience } from "../production/directExperience";
import { SiteError } from "../SiteError";
import type { Site } from "../schema";
import type { ReleaseContext } from "../production/schema";
const m = vi.hoisted(() => ({
  verify: vi.fn(),
  analyze: vi.fn(),
  credits: vi.fn(),
  search: vi.fn(),
  charge: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("@/lib/flamingo/verifyAudioUrl", () => ({ verifyAudioUrl: m.verify }));
vi.mock("@/lib/flamingo/processAnalyzeMusicRequest", () => ({
  processAnalyzeMusicRequest: m.analyze,
}));
vi.mock("../production/requireCredits", () => ({ requireCredits: m.credits }));
vi.mock("@/lib/perplexity/searchPerplexity", () => ({ searchPerplexity: m.search }));
vi.mock("@/lib/credits/recordCreditDeduction", () => ({ recordCreditDeduction: m.charge }));
vi.mock("../production/generateProductionObject", () => ({ generateProductionObject: m.generate }));
const site = { id: "site", assets: [], draft: null } as unknown as Site;
const release = {
  url: "https://open.spotify.com/track/abc",
  title: "Song",
  artists: ["Artist"],
  previewUrl: null,
} as ReleaseContext["release"];
beforeEach(() => {
  vi.resetAllMocks();
  m.verify.mockResolvedValue({ ok: true });
  m.analyze.mockResolvedValue({ type: "success", response: "Bright percussion" });
});
it("does not call Flamingo when audio was not resolved", async () => {
  expect(await analyzeReleaseMusic(site, release, "account")).toMatchObject({
    status: "unavailable",
    coverage: "none",
  });
  expect(m.analyze).not.toHaveBeenCalled();
});
it("labels a provider preview as a preview, never a full recording", async () => {
  const result = await analyzeReleaseMusic(
    site,
    { ...release, previewUrl: "https://p.scdn.co/clip.mp3" },
    "account",
  );
  expect(result).toMatchObject({ status: "analyzed", coverage: "preview" });
  expect(m.analyze.mock.calls[0][1]).toEqual({ accountId: "account" });
});
it("rejects unverifiable audio before spending", async () => {
  m.verify.mockResolvedValue({ ok: false });
  await analyzeReleaseMusic(
    site,
    { ...release, previewUrl: "https://p.scdn.co/clip.mp3" },
    "account",
  );
  expect(m.analyze).not.toHaveBeenCalled();
});
it("does not convert insufficient credits into missing music", async () => {
  m.credits.mockRejectedValue(new SiteError(402, "Credits required"));
  await expect(
    analyzeReleaseMusic(site, { ...release, previewUrl: "https://p.scdn.co/clip.mp3" }, "account"),
  ).rejects.toMatchObject({ status: 402 });
});
it("preserves source links and caps research content", async () => {
  m.search.mockResolvedValue({
    results: [
      {
        title: "Artist interview",
        url: "https://artist.test/interview",
        snippet: "x".repeat(9000),
      },
    ],
  });
  const result = await researchArtist(release, "account");
  expect(result.sources[0].url).toBe("https://artist.test/interview");
  expect(result.sources[0].snippet.length).toBe(4000);
  expect(m.charge).toHaveBeenCalledOnce();
});
it("marks research outages as unavailable", async () => {
  m.search.mockRejectedValue(new Error("offline"));
  expect(await researchArtist(release, "account")).toMatchObject({
    status: "unavailable",
    sources: [],
  });
});
it("rejects a nonexistent selected concept", async () => {
  m.generate.mockResolvedValue({ selectedIndex: 2, candidates: [{}] });
  await expect(
    directExperience(site, "", { release } as ReleaseContext, "account"),
  ).rejects.toThrow("unavailable concept");
});
