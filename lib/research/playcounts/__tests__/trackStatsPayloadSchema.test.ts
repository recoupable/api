import { describe, it, expect } from "vitest";
import { trackStatsPayloadSchema } from "../trackStatsPayloadSchema";

describe("trackStatsPayloadSchema", () => {
  it("parses a Songstats payload, preserving unknown envelope fields", () => {
    const payload = {
      result: "success",
      message: "Data Retrieved.",
      track_info: { name: "The Spins", songstats_track_id: "x" },
      source_ids: ["spotify"],
      stats: [{ source: "spotify", data: { streams_total: 84, future_field: 1 }, extra: true }],
    };

    const parsed = trackStatsPayloadSchema.parse(payload);

    expect(parsed.stats?.[0].source).toBe("spotify");
    expect(parsed).toEqual(payload);
  });

  it("accepts payloads without stats (envelope-only)", () => {
    expect(trackStatsPayloadSchema.parse({ result: "success" })).toEqual({ result: "success" });
  });

  it("rejects non-object payloads and malformed stats", () => {
    expect(trackStatsPayloadSchema.safeParse("raw").success).toBe(false);
    expect(trackStatsPayloadSchema.safeParse({ stats: "not-an-array" }).success).toBe(false);
    expect(trackStatsPayloadSchema.safeParse({ stats: [42] }).success).toBe(false);
  });
});
