import { describe, it, expect } from "vitest";
import { compareCatalogPlaycountHistory } from "../compareCatalogPlaycountHistory";

const query = { since: "2026-09-03", days: 2 };
const rows = (values: number[]) =>
  values.map((value, index) => ({
    captured_at: `2026-09-0${index + 1}T07:00:00.000Z`,
    value,
  }));

describe("compareCatalogPlaycountHistory", () => {
  it("compares equal complete observation periods and retains daily history", () => {
    const result = compareCatalogPlaycountHistory(rows([10, 12, 15, 19, 25]), query);
    expect(result).toMatchObject({
      state: "comparable",
      previous_change: 5,
      current_change: 10,
      absolute_growth: 5,
      percentage_growth: 100,
    });
    expect(result.observations).toHaveLength(5);
  });
  it("preserves a real zero baseline without infinite percentage growth", () => {
    expect(compareCatalogPlaycountHistory(rows([0, 0, 0, 1, 2]), query)).toMatchObject({
      state: "comparable",
      previous_change: 0,
      current_change: 2,
      absolute_growth: 2,
      percentage_growth: null,
      zero_baseline: true,
    });
  });
  it("does not interpolate missing days or call missing zero", () => {
    const data = rows([10, 12, 15, 19, 25]).filter((_, index) => index !== 1);
    expect(compareCatalogPlaycountHistory(data, query)).toMatchObject({
      state: "incomplete",
      missing_days: ["2026-09-02"],
      current_change: null,
      previous_change: null,
      percentage_growth: null,
    });
  });
  it("flags an intermediate counter correction even when endpoints increase", () => {
    expect(compareCatalogPlaycountHistory(rows([10, 9, 15, 19, 25]), query)).toMatchObject({
      state: "counter_correction",
      correction_days: ["2026-09-02"],
      current_change: null,
      previous_change: null,
    });
  });
  it("does not treat invalid counts or threshold sentinels as exact zero", () => {
    expect(compareCatalogPlaycountHistory(rows([10, 12, -1, 19, 25]), query).state).toBe(
      "invalid_observation",
    );
    expect(compareCatalogPlaycountHistory(rows([10, 12, NaN, 19, 25]), query).state).toBe(
      "invalid_observation",
    );
  });
  it("selects the latest daily capture independently of input order", () => {
    const data = [
      ...rows([10, 12, 15, 19, 25]),
      { captured_at: "2026-09-03T01:00:00Z", value: 13 },
    ].reverse();
    expect(compareCatalogPlaycountHistory(data, query).previous_change).toBe(5);
  });
  it("reports observation timing rather than claiming calendar-day streams", () => {
    const data = rows([10, 12, 15, 19, 25]);
    data[4].captured_at = "2026-09-05T22:00:00Z";
    expect(compareCatalogPlaycountHistory(data, query)).toMatchObject({
      state: "unaligned_observations",
      previous_change: null,
      current_change: null,
    });
  });
  it("ignores observations outside the requested periods", () => {
    expect(
      compareCatalogPlaycountHistory(
        [...rows([10, 12, 15, 19, 25]), { captured_at: "2026-09-06T07:00:00Z", value: 1000 }],
        query,
      ).current_change,
    ).toBe(10);
  });
});
