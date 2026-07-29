import { describe, it, expect } from "vitest";
import { buildValuationDeltaSubjectPrefix } from "../buildValuationDeltaSubjectPrefix";

const cur = (mid: number) => ({
  low: mid * 0.8,
  mid,
  high: mid * 1.2,
  measured_at: "2026-07-29T00:00:00Z",
});

describe("buildValuationDeltaSubjectPrefix", () => {
  it("leads with the current mid and the signed percent change", () => {
    expect(
      buildValuationDeltaSubjectPrefix({ current: cur(1_100_000), previous: cur(1_000_000) }),
    ).toBe("$1.1M (+10.0%) · ");
  });

  it("keeps the sign on a decline", () => {
    expect(
      buildValuationDeltaSubjectPrefix({ current: cur(900_000), previous: cur(1_000_000) }),
    ).toBe("$900K (-10.0%) · ");
  });

  it("marks the baseline when there is no previous measurement", () => {
    expect(buildValuationDeltaSubjectPrefix({ current: cur(1_100_000), previous: null })).toBe(
      "$1.1M baseline · ",
    );
  });

  it("omits the percent when the previous mid is zero", () => {
    expect(buildValuationDeltaSubjectPrefix({ current: cur(1_100_000), previous: cur(0) })).toBe(
      "$1.1M · ",
    );
  });
});
