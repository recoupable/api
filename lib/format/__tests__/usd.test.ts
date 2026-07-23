import { describe, it, expect } from "vitest";
import { usd } from "@/lib/format/usd";

describe("usd", () => {
  it("formats whole dollars with thousands separators", () => {
    expect(usd(54_600_000)).toBe("$54,600,000");
    expect(usd(0)).toBe("$0");
    expect(usd(1_234)).toBe("$1,234");
  });

  it("rounds to the nearest whole dollar", () => {
    expect(usd(33_512_367.0588)).toBe("$33,512,367");
    expect(usd(0.6)).toBe("$1");
  });
});
