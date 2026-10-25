import { describe, expect, it, vi, afterEach } from "vitest";
import { buildReleasePackQuote } from "../buildReleasePackQuote";
import { releasePackBriefSchema, releasePackDeliverablesSchema } from "../releasePackSchema";
import { assertPackQuoteConfiguration } from "../assertPackQuoteConfiguration";
import { getPackConfigurationDigest } from "../getPackConfigurationDigest";
import * as config from "../getPackExecutionConfiguration";

const brief = releasePackBriefSchema.parse({
  artist_name: "Fixture",
  song_title: "Song",
  occasion: "rediscovery",
  audio_url: "https://example.com/song.wav",
  allow_creative_defaults: true,
});
const deliverables = releasePackDeliverablesSchema.parse({});
afterEach(() => vi.restoreAllMocks());
describe("quote execution configuration", () => {
  it("saves server configuration and accepts its JSON-storage key reordering", () => {
    const quote = buildReleasePackQuote(brief, deliverables);
    expect(quote.execution_config_digest).toBe(getPackConfigurationDigest(quote.execution_config));
    quote.execution_config = Object.fromEntries(
      Object.entries(quote.execution_config).reverse(),
    ) as typeof quote.execution_config;
    expect(() => assertPackQuoteConfiguration(quote)).not.toThrow();
  });
  it.each(["model", "settings", "rates"])(
    "invalidates approval when current %s configuration changes",
    kind => {
      const quote = buildReleasePackQuote(brief, deliverables);
      const original = config.getPackExecutionConfiguration();
      const changed = structuredClone(original);
      if (kind === "model") changed.models.caption = "different-model";
      else if (kind === "settings")
        (changed.caption as { maxOutputTokens: number }).maxOutputTokens = 351;
      else changed.rates.image_usd_per_unit = 0.02;
      vi.spyOn(config, "getPackExecutionConfiguration").mockReturnValue(changed);
      expect(() => assertPackQuoteConfiguration(quote)).toThrow(/new estimate/);
      const replacement = buildReleasePackQuote(brief, deliverables);
      expect(replacement.fingerprint).not.toBe(quote.fingerprint);
    },
  );
  it("rejects legacy or altered snapshots instead of interpreting them as current", () => {
    expect(() => assertPackQuoteConfiguration({})).toThrow(/new estimate/);
    const quote = buildReleasePackQuote(brief, deliverables);
    quote.execution_config.adapter_version = "tampered";
    expect(() => assertPackQuoteConfiguration(quote)).toThrow(/new estimate/);
  });
});
