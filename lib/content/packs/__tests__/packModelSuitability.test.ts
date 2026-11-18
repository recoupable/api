import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReleasePackQuote } from "../buildReleasePackQuote";
import { releasePackBriefSchema, releasePackDeliverablesSchema } from "../releasePackSchema";
import { assertPackQuoteConfiguration } from "../assertPackQuoteConfiguration";
import { getPackConfigurationDigest } from "../getPackConfigurationDigest";
import * as evidence from "../getPackModelEvidence";
const brief = releasePackBriefSchema.parse({
  artist_name: "Fixture",
  song_title: "Song",
  occasion: "rediscovery",
  audio_url: "https://example.com/song.wav",
  allow_creative_defaults: true,
});
const only = (kind: string) =>
  releasePackDeliverablesSchema.parse({
    videos: 0,
    artwork: 0,
    quote_cards: 0,
    carousels: 0,
    visualizers: 0,
    [kind]: 1,
  });
afterEach(() => vi.restoreAllMocks());
describe("model suitability assessment without production activation", () => {
  it.each([
    ["artwork", ["analysis", "image", "caption", "still_inspection"]],
    ["videos", ["analysis", "image", "caption", "motion", "video_inspection"]],
    ["visualizers", ["analysis", "image", "caption", "video_inspection"]],
  ])("reports only planned provider tasks for %s", (kind, tasks) => {
    const quote = buildReleasePackQuote(brief, only(kind as string));
    expect(Object.keys(quote.model_readiness.tasks)).toEqual(tasks);
    expect(quote.model_readiness.assessment_only).toBe(true);
    expect(quote.model_readiness.ready).toBe(false);
    expect(quote.model_readiness.tasks.analysis?.issues).toContain("commercial basis restricted");
    expect(() => assertPackQuoteConfiguration(quote)).not.toThrow();
  });
  it("uses the editing route for selected production references", () => {
    const quote = buildReleasePackQuote(
      { ...brief, reference_image_urls: ["https://example.com/art.png"] },
      only("artwork"),
    );
    expect(quote.model_readiness.tasks.image_edit).toBeDefined();
    expect(quote.model_readiness.tasks.image).toBeUndefined();
    expect(() =>
      buildReleasePackQuote(
        {
          ...brief,
          reference_image_urls: ["https://example.com/art.png"],
          model_choices: { image: "meta/muse-image/text-to-image" },
        },
        only("artwork"),
      ),
    ).toThrow(/does not apply/);
    expect(() =>
      buildReleasePackQuote(
        { ...brief, model_choices: { motion: "minimax/h3-max/image-to-video" } },
        only("artwork"),
      ),
    ).toThrow(/does not apply/);
  });
  it("keeps old execution identity and changes only new assessment fingerprints", () => {
    const quote = buildReleasePackQuote(brief, only("artwork"));
    expect(quote.execution_config_digest).toBe(
      "012c31125aaae1e336fc23bfa69c7b22b9d6b0b4de9d9f93e7c00678caeb7a24",
    );
    const changed = evidence.getPackModelEvidence();
    changed.version = "updated";
    vi.spyOn(evidence, "getPackModelEvidence").mockReturnValue(changed);
    expect(() => assertPackQuoteConfiguration(quote)).not.toThrow();
    const replacement = buildReleasePackQuote(brief, only("artwork"));
    expect(replacement.execution_config_digest).toBe(quote.execution_config_digest);
    expect(replacement.model_readiness.digest).not.toBe(quote.model_readiness.digest);
    expect(replacement.fingerprint).not.toBe(quote.fingerprint);
    const { digest, ...report } = replacement.model_readiness;
    expect(digest).toBe(getPackConfigurationDigest(report));
  });
  it("retains exact explicit choices and rejects substitution", () => {
    const selected = releasePackBriefSchema.parse({
      ...brief,
      model_choices: { caption: "openai/gpt-4o-mini" },
    });
    const quote = buildReleasePackQuote(selected, only("artwork"));
    expect(quote.execution_config.models.caption).toBe(selected.model_choices?.caption);
    expect(quote.brief_fingerprint).not.toBe(
      buildReleasePackQuote(brief, only("artwork")).brief_fingerprint,
    );
    expect(() =>
      buildReleasePackQuote(
        { ...brief, model_choices: { caption: "unsupported" } },
        only("artwork"),
      ),
    ).toThrow(/no substitution/i);
    expect(() =>
      releasePackBriefSchema.parse({ ...brief, model_choices: { invented: "model" } }),
    ).toThrow();
  });
});
