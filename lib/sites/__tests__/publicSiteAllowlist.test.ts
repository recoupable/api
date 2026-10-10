import { beforeEach, describe, expect, it, vi } from "vitest";
import { processPublicSite } from "../processPublicSite";
import { serializePublicSiteSnapshot } from "../serializePublicSiteSnapshot";
import { getSitePlaybackAudio } from "../getSitePlaybackAudio";
import type { SiteSnapshot } from "../schema";
import type { CreativeDirection } from "../production/schema";
import type { BrandWorld } from "../brandWorld/schema";

vi.mock("@/lib/supabase/site_fan_connections/selectFanConfig", () => ({
  selectFanConfig: vi.fn(async () => null),
}));
const m = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/supabase/sites/selectSite", () => ({ selectSite: m.select }));
vi.mock("@/lib/supabase/sites/insertSignup", () => ({ insertSignup: m.insert }));
vi.mock("../getSitePlaybackAudio", () => ({
  getSitePlaybackAudio: vi.fn(async () => "https://files.example.com/signed-playback.wav"),
}));

const id = "11111111-1111-4111-8111-111111111111";
const briefId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const releaseUrl = "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC";
const privateMarkers = [
  briefId,
  requestId,
  "PRIVATE_DOCUMENT_TEXT",
  "PRIVATE_GUIDANCE",
  "PRIVATE_GAP_REASON",
  "PRIVATE_RESEARCH_SNIPPET",
  "PRIVATE_DIRECTION_CONCEPT",
  "PRIVATE_REVIEW_SUMMARY",
  "PRIVATE_BRAND_WORLD",
  "PRIVATE_ASSET_RATIONALE",
  "PRIVATE_FUTURE_FIELD",
  "PRIVATE_SITE_SKILL",
];
const design = {
  headline: "Hear it first",
  eyebrow: "New single",
  description: "Out now everywhere",
  buttonLabel: "Listen",
  signupHeading: "Join the list",
  background: "#000000",
  foreground: "#ffffff",
  accent: "#ff00aa",
  layout: "poster" as const,
  font: "sans" as const,
};
const experience = {
  html: "<main>Hello</main>",
  css: "main{color:red}",
  javascript: "console.log('hello')",
};
const publicAssets = [
  { url: "https://cdn.example.com/cover.png", name: "Cover", type: "image" as const },
  { url: "https://cdn.example.com/teaser.mp4", name: "Teaser", type: "video" as const },
];

/** A published snapshot carrying every private field the engine can store, plus an unknown one. */
function privatePublished(): SiteSnapshot & { futurePrivateField: string } {
  return {
    name: "Public",
    artistName: "Stored Name",
    releaseUrl,
    assets: [
      {
        ...publicAssets[0],
        generation: {
          provider: "fal",
          model: "image-model",
          requestId: "gen-1",
          rationale: "PRIVATE_ASSET_RATIONALE",
          durationMs: 1200,
        },
      },
      publicAssets[1],
    ],
    design: { ...design, experience },
    production: {
      version: 1,
      status: "reviewed",
      context: {
        gaps: [{ trackUrl: releaseUrl, topic: "lyrics", reason: "PRIVATE_GAP_REASON" }],
        siteSkill: { text: "PRIVATE_SITE_SKILL" } as unknown as NonNullable<
          SiteSnapshot["production"]
        >["context"]["siteSkill"],
        engine: {
          briefId,
          requestIds: [requestId],
          documents: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              resultId: "55555555-5555-4555-8555-555555555555",
              subjectId: "66666666-6666-4666-8666-666666666666",
              topic: "song_summary",
              version: 1,
              evidenceKind: "analysis",
              text: "PRIVATE_DOCUMENT_TEXT",
              coverage: "full",
              sourceVersionIds: [],
            },
          ],
          missingTopics: ["lyrics"],
          guidance: "PRIVATE_GUIDANCE",
        },
        release: {
          url: releaseUrl,
          title: "Song",
          artists: ["Artist One", "Artist Two"],
          artwork: null,
          date: null,
          isrc: null,
          previewUrl: null,
        },
        music: { status: "unavailable", coverage: "none", analysis: "" },
        research: {
          status: "available",
          sources: [
            { title: "Interview", url: "https://example.com", snippet: "PRIVATE_RESEARCH_SNIPPET" },
          ],
        },
      },
      direction: { concept: "PRIVATE_DIRECTION_CONCEPT" } as unknown as CreativeDirection,
      reviews: [{ verdict: "pass", issues: [], summary: "PRIVATE_REVIEW_SUMMARY" }],
    },
    brandWorld: {
      version: 1,
      model: "brand-model",
      sourceAssets: [],
      specification: { summary: "PRIVATE_BRAND_WORLD" } as unknown as BrandWorld,
    },
    futurePrivateField: "PRIVATE_FUTURE_FIELD",
  };
}

const expectNoPrivateMarkers = (value: unknown) => {
  const json = JSON.stringify(value);
  for (const marker of privateMarkers) expect(json).not.toContain(marker);
};

beforeEach(() => vi.resetAllMocks());

describe("serializePublicSiteSnapshot", () => {
  it("copies only the allowlisted public fields and derives artistName before discarding context", () => {
    const published = privatePublished();
    const result = serializePublicSiteSnapshot(published);
    expect(result).toStrictEqual({
      name: "Public",
      artistName: "Artist One, Artist Two",
      releaseUrl,
      assets: publicAssets,
      design: { ...design, experience },
    });
    expect(Object.keys(result).sort()).toEqual(
      ["artistName", "assets", "design", "name", "releaseUrl"].sort(),
    );
    expectNoPrivateMarkers(result);
    // Serialization must not strip the stored row the playback lookup still reads.
    expect(published.production?.context.engine?.briefId).toBe(briefId);
    expect(published.brandWorld?.specification).toBeDefined();
  });

  it("passes executable experience code through unchanged and omits it when absent", () => {
    const withExperience = serializePublicSiteSnapshot(privatePublished());
    expect(withExperience.design.experience).toStrictEqual(experience);
    const withoutExperience = serializePublicSiteSnapshot({
      ...privatePublished(),
      design,
    });
    expect(withoutExperience.design).toStrictEqual(design);
    expect("experience" in withoutExperience.design).toBe(false);
  });

  it("serializes legacy snapshots without production, falling back to the stored artist name", () => {
    const legacy: SiteSnapshot = { name: "Legacy", releaseUrl: "", assets: [], design };
    expect(serializePublicSiteSnapshot(legacy)).toStrictEqual({
      name: "Legacy",
      releaseUrl: "",
      assets: [],
      design,
    });
    expect(serializePublicSiteSnapshot({ ...legacy, artistName: "Stored Name" }).artistName).toBe(
      "Stored Name",
    );
  });
});

describe("processPublicSite", () => {
  it("returns the allowlisted snapshot while playback still reads the stored row", async () => {
    const site = {
      id,
      owner_id: "private-owner",
      draft: { secret: true },
      published: privatePublished(),
    };
    m.select.mockResolvedValue(site);
    const response = await processPublicSite(id);
    expect(response).toStrictEqual({
      snapshot: serializePublicSiteSnapshot(site.published),
      fanConnectUrl: null,
      playbackAudioUrl: "https://files.example.com/signed-playback.wav",
    });
    expectNoPrivateMarkers(response);
    expect(JSON.stringify(response)).not.toContain("private-owner");
    expect(vi.mocked(getSitePlaybackAudio)).toHaveBeenCalledWith(site);
  });
});
