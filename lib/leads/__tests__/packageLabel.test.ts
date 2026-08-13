import { describe, it, expect } from "vitest";
import { packageLabel } from "@/lib/leads/packageLabel";

describe("packageLabel", () => {
  it("labels the advisory packages", () => {
    expect(packageLabel("strategy-session")).toBe("Strategy Session ($2,500)");
    expect(packageLabel("ai-transformation")).toBe("AI Transformation ($10,000)");
    expect(packageLabel("retained-advisor")).toBe("Retained Advisor ($5,000/mo)");
  });

  // The /build offering (chat#1800 Phase 2): three tiers, "from" floors.
  it("labels the build packages", () => {
    expect(packageLabel("care-plan")).toBe("Care Plan (from $750/mo)");
    expect(packageLabel("starter-build")).toBe("Starter Build (from $2,500)");
    expect(packageLabel("custom-build")).toBe("Custom Build (from $10k)");
  });

  it("falls back to the raw slug for an unknown package", () => {
    expect(packageLabel("mystery-tier")).toBe("mystery-tier");
  });
});
