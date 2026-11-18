import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReleasePackQuote } from "../buildReleasePackQuote";
import { releasePackBriefSchema, releasePackDeliverablesSchema } from "../releasePackSchema";
import { assertPackNewWork } from "../assertPackNewWork";
import { assertPackQuoteConfiguration } from "../assertPackQuoteConfiguration";
import * as evidence from "../getPackModelEvidence";
const brief = releasePackBriefSchema.parse({
  artist_name: "Fixture",
  song_title: "Song",
  occasion: "rediscovery",
  audio_url: "https://example.com/song.wav",
  allow_creative_defaults: true,
});
const deliverables = releasePackDeliverablesSchema.parse({});
afterEach(() => vi.restoreAllMocks());
describe("server-owned model suitability", () => {
  it("quotes current uncertainty but refuses new work", () => {
    const quote = buildReleasePackQuote(brief, deliverables);
    expect(quote.execution_config.model_evidence.version).toBe("2026-11-18.1");
    expect(() => assertPackQuoteConfiguration(quote)).not.toThrow();
    expect(() => assertPackNewWork(quote)).toThrow(/commercial|availability/);
  });
  it("preserves an explicit supported choice and rejects substitution", () => {
    const selected = releasePackBriefSchema.parse({
      ...brief,
      model_choices: { caption: "openai/gpt-4o-mini" },
    });
    const quote = buildReleasePackQuote(selected, deliverables);
    expect(quote.execution_config.models.caption).toBe(selected.model_choices?.caption);
    expect(quote.brief_fingerprint).not.toBe(
      buildReleasePackQuote(brief, deliverables).brief_fingerprint,
    );
    expect(() =>
      buildReleasePackQuote(
        { ...brief, model_choices: { caption: "not-supported" } },
        deliverables,
      ),
    ).toThrow(/caption.*not-supported.*no substitution/i);
    expect(() =>
      releasePackBriefSchema.parse({ ...brief, model_choices: { invented: "model" } }),
    ).toThrow();
  });
  it("binds evidence updates into the approved configuration", () => {
    const quote = buildReleasePackQuote(brief, deliverables);
    const changed = evidence.getPackModelEvidence();
    changed.version = "updated";
    vi.spyOn(evidence, "getPackModelEvidence").mockReturnValue(changed);
    expect(() => assertPackQuoteConfiguration(quote)).toThrow(/new estimate/);
  });
  it("admits only fully evidenced current routes, refusing unknown, retired, expired and mismatched bindings", () => {
    const fixture = evidence.getPackModelEvidence();
    for (const entry of Object.values(fixture.tasks)) {
      entry.capability = "verified";
      entry.commercial_basis = "verified";
      entry.account_availability = "verified";
      entry.lifecycle = "supported";
      entry.valid_until = "2099-01-01T00:00:00.000Z";
      entry.evidence = ["https://example.invalid/synthetic-test-evidence"];
    }
    vi.spyOn(evidence, "getPackModelEvidence").mockImplementation(() => structuredClone(fixture));
    expect(() => assertPackNewWork(buildReleasePackQuote(brief, deliverables))).not.toThrow();
    const original = structuredClone(fixture.tasks.analysis);
    for (const patch of [
      { commercial_basis: "unknown" },
      { account_availability: "unknown" },
      { capability: "unknown" },
      { lifecycle: "retired" },
      { valid_until: "2000-01-01T00:00:00.000Z" },
      { model: "other-route" },
      { endpoint: "https://example.invalid/other" },
      { evidence: [] },
    ]) {
      Object.assign(fixture.tasks.analysis, original, patch);
      expect(() => assertPackNewWork(buildReleasePackQuote(brief, deliverables))).toThrow();
    }
    Object.assign(fixture.tasks.analysis, original);
    delete (fixture.tasks as Partial<typeof fixture.tasks>).analysis;
    expect(() => assertPackNewWork(buildReleasePackQuote(brief, deliverables))).toThrow(
      /missing task evidence/,
    );
  });
});
