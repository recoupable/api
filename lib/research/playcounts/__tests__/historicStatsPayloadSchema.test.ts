import { describe, it, expect } from "vitest";
import { historicStatsPayloadSchema } from "../historicStatsPayloadSchema";

describe("historicStatsPayloadSchema", () => {
  it("parses a Songstats historic payload, preserving unknown fields", () => {
    const payload = {
      result: "success",
      track_info: { name: "The Spins" },
      stats: [
        {
          source: "deezer",
          data: { history: [{ date: "2026-06-01", streams_total: 1, extra: true }] },
        },
      ],
    };

    const parsed = historicStatsPayloadSchema.parse(payload);

    expect(parsed.stats?.[0].data?.history?.[0].date).toBe("2026-06-01");
    expect(parsed).toEqual(payload);
  });

  it("rejects non-object payloads and malformed history", () => {
    expect(historicStatsPayloadSchema.safeParse("raw").success).toBe(false);
    expect(
      historicStatsPayloadSchema.safeParse({ stats: [{ data: { history: "x" } }] }).success,
    ).toBe(false);
  });
});
