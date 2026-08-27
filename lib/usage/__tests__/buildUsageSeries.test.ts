import { describe, it, expect } from "vitest";
import { buildUsageSeries } from "@/lib/usage/buildUsageSeries";

const row = (created_at: string, credits_deducted: number) => ({ created_at, credits_deducted });

describe("buildUsageSeries", () => {
  it("groups rows into ascending buckets with the sum, the count and the USD string", () => {
    const series = buildUsageSeries(
      [
        row("2026-08-13T21:56:00.000Z", 150_000),
        row("2026-08-13T00:32:00.000Z", 150_000),
        row("2026-08-12T17:27:00.000Z", 10_000),
      ],
      "day",
    );
    expect(series).toEqual([
      { start: "2026-08-12T00:00:00.000Z", credits_deducted: 10_000, usd: "$0.01", events: 1 },
      { start: "2026-08-13T00:00:00.000Z", credits_deducted: 300_000, usd: "$0.30", events: 2 },
    ]);
  });

  it("sums to the total of its rows", () => {
    const rows = [
      row("2026-08-01T01:00:00Z", 1),
      row("2026-08-20T01:00:00Z", 2),
      row("2026-08-27T01:00:00Z", 3),
    ];
    const sum = buildUsageSeries(rows, "week").reduce((t, p) => t + p.credits_deducted, 0);
    expect(sum).toBe(6);
  });

  it("is empty for no rows", () => {
    expect(buildUsageSeries([], "hour")).toEqual([]);
  });
});
