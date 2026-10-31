import { describe, expect, it } from "vitest";
import type { Tables } from "@/types/database.types";
import { toUsageEvent } from "@/lib/usage/toUsageEvent";
import { decodeUsageCursor } from "@/lib/usage/decodeUsageCursor";
import { getSocialScrapeCreditCost } from "@/lib/socials/getSocialScrapeCreditCost";
import fixture from "../fixtures/published-docs.json";

describe("published usage and artist scrape contracts", () => {
  it("accepts all nullable fields actually emitted by the mapper", () => {
    const row: Tables<"usage_events"> = {
      id: "3AANn3Ij9uF-zZIlW_zlP",
      account_id: "fixture",
      created_at: "2026-08-27T11:56:58Z",
      credits_deducted: 0,
      source: null,
      agent_type: null,
      provider: null,
      model_id: null,
      input_tokens: null,
      cached_input_tokens: null,
      output_tokens: null,
      tool_call_count: null,
      resource_url: null,
    };
    const nullFields = Object.entries(toUsageEvent(row))
      .filter(([, value]) => value === null)
      .map(([name]) => name);
    expect(fixture.contracts.usageEventNullables).toEqual(expect.arrayContaining(nullFields));
  });
  it("publishes a time cursor with both timestamp and row ID", () => {
    expect(decodeUsageCursor("created_at", fixture.contracts.usageTimeCursorExample)).toEqual({
      createdAt: "2026-08-27T11:56:58.000000Z",
      id: "3AANn3Ij9uF-zZIlW_zlP",
    });
  });
  it("shows the actual artist-wide base and per-post unit cost", () => {
    expect(fixture.contracts.social.artistBaseCredits).toBe(getSocialScrapeCreditCost());
    expect(fixture.contracts.social.artistPerPostCredits).toBe(
      getSocialScrapeCreditCost(1) - getSocialScrapeCreditCost(),
    );
  });
  it("uses micro-dollar credits in the 20-post insufficient-credit example", () => {
    expect(fixture.contracts.social.requiredCreditsExample).toBe(getSocialScrapeCreditCost(20));
  });
});
