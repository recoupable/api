import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildReleasePackQuote } from "../buildReleasePackQuote";
import { readPackSnapshot } from "../readPackSnapshot";
import { assertPackQuoteConfiguration } from "../assertPackQuoteConfiguration";
import { releasePackBriefSchema, releasePackDeliverablesSchema } from "../releasePackSchema";
import type { PackSnapshot } from "../packTypes";
vi.mock("@/lib/supabase/storage/createSignedFileUrlByKey", () => ({
  createSignedFileUrlByKey: vi.fn(),
}));
const brief = releasePackBriefSchema.parse({
  artist_name: "Fixture",
  song_title: "Song",
  occasion: "rediscovery",
  audio_url: "https://example.com/song.wav",
  allow_creative_defaults: true,
});
const deliverables = releasePackDeliverablesSchema.parse({
  videos: 0,
  artwork: 1,
  quote_cards: 0,
  carousels: 0,
  visualizers: 0,
});
const accounting = {
  amount_basis: "customer_charge",
  included_services: "no_additional_customer_charge",
  provider_cost_usd: null,
  provider_cost_status: "not_measured",
  concepts: "not_budgeted",
  contingency: "not_budgeted",
  refinements: "not_budgeted",
};
describe("pack quote cost accounting", () => {
  it("labels house charges without representing included provider expense as zero", () => {
    const quote = buildReleasePackQuote(brief, deliverables);
    expect(quote).toHaveProperty("cost_accounting", accounting);
    expect(quote.maximum_usd).toBe(0.01);
    expect(quote.line_items.filter(item => item.included).every(item => item.usd === 0)).toBe(true);
    expect(quote.assets[0].maximum_usd).toBe(0.01);
  });
  it("preserves the production fingerprint and configuration for unchanged prices and scope", () => {
    const quote = buildReleasePackQuote(brief, deliverables);
    expect(quote.fingerprint).toBe(
      createHash("sha256")
        .update(
          JSON.stringify({
            brief,
            deliverables,
            execution_config_digest: quote.execution_config_digest,
          }),
        )
        .digest("hex"),
    );
    const legacy = JSON.parse(JSON.stringify(quote));
    delete legacy.cost_accounting;
    expect(() => assertPackQuoteConfiguration(legacy)).not.toThrow();
  });
  it.each([false, true])(
    "clarifies saved quote readback without rewriting approval (metadata present: %s)",
    async present => {
      const quote = {
        ...buildReleasePackQuote(brief, deliverables),
        id: "quote",
        revision: 1,
        expires_at: "2026-10-26T12:00:00Z",
      };
      const saved = JSON.parse(JSON.stringify(quote));
      if (!present) delete saved.cost_accounting;
      const snapshot: PackSnapshot = {
        job: {
          id: "job",
          owner_id: "owner",
          created_by: "owner",
          revision: 1,
          status: "awaiting_approval",
          brief,
          deliverables,
          quote: saved,
          held_credits: 0,
          consumed_credits: 0,
          workflow_run_id: null,
          error: null,
        },
        assets: [],
      };
      const before = structuredClone(snapshot);
      const result = await readPackSnapshot(snapshot);
      expect(result.job.quote).toHaveProperty("cost_accounting", accounting);
      expect(result.job.quote).toMatchObject({
        id: saved.id,
        fingerprint: saved.fingerprint,
        execution_config_digest: saved.execution_config_digest,
        maximum_usd: saved.maximum_usd,
        credits: saved.credits,
      });
      expect(snapshot).toEqual(before);
    },
  );
});
