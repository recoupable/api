import { describe, it, expect } from "vitest";
import { formatUsd } from "@/lib/stripe/formatUsd";

describe("formatUsd", () => {
  it("formats cents as dollars", () => {
    expect(formatUsd(9900)).toBe("$99.00");
    expect(formatUsd(546)).toBe("$5.46");
    expect(formatUsd(500000)).toBe("$5000.00");
  });

  it("formats zero", () => {
    expect(formatUsd(0)).toBe("$0.00");
  });

  it("formats negative amounts (net refunds)", () => {
    expect(formatUsd(-150)).toBe("-$1.50");
  });
});
