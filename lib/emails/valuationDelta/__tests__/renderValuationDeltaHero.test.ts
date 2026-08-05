import { describe, it, expect } from "vitest";
import { renderValuationDeltaHero } from "../renderValuationDeltaHero";

const cur = (mid: number, at = "2026-07-29T00:00:00Z") => ({
  low: mid * 0.8,
  mid,
  high: mid * 1.2,
  measured_at: at,
});

describe("renderValuationDeltaHero", () => {
  it("renders previous → current with the signed percent change", () => {
    const html = renderValuationDeltaHero({
      current: cur(1_100_000),
      previous: cur(1_000_000, "2026-07-22T00:00:00Z"),
    });

    expect(html).toContain("$1M");
    expect(html).toContain("$1.1M");
    expect(html).toContain("+10.0%");
    expect(html).toContain("since your last measurement");
  });

  it("renders the baseline framing when there is no previous measurement", () => {
    const html = renderValuationDeltaHero({ current: cur(1_100_000), previous: null });

    expect(html).toContain("$1.1M");
    expect(html).toContain("baseline is set");
    expect(html).not.toMatch(/[+-]\d+\.\d%/);
  });

  it("contains no em or en dashes (user-facing copy rule)", () => {
    for (const previous of [cur(1_000_000), null]) {
      expect(renderValuationDeltaHero({ current: cur(1_100_000), previous })).not.toMatch(/[—–]/);
    }
  });
});
