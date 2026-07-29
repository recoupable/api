import { describe, it, expect } from "vitest";
import { formatCompactNumber } from "../formatCompactNumber";

describe("formatCompactNumber", () => {
  it("passes small numbers through, rounded to integers", () => {
    expect(formatCompactNumber(0)).toBe("0");
    expect(formatCompactNumber(678)).toBe("678");
    expect(formatCompactNumber(999.6)).toBe("1K");
  });

  it("formats thousands with one decimal, trailing .0 stripped", () => {
    expect(formatCompactNumber(12_345)).toBe("12.3K");
    expect(formatCompactNumber(10_000)).toBe("10K");
  });

  it("formats millions", () => {
    expect(formatCompactNumber(1_200_000)).toBe("1.2M");
    expect(formatCompactNumber(348_000_000)).toBe("348M");
  });

  it("formats billions (large catalog lifetime streams)", () => {
    expect(formatCompactNumber(1_400_000_000)).toBe("1.4B");
  });
});
