import { describe, it, expect } from "vitest";
import { renderValuationPayoff } from "../renderValuationPayoff";

const BASE = "https://chat.example.com";

describe("renderValuationPayoff", () => {
  it("links the payoff at /setup/valuation", () => {
    const html = renderValuationPayoff(BASE);

    expect(html).toContain(`href="${BASE}/setup/valuation"`);
  });

  it("frames the valuation as the reward, not a numbered step", () => {
    const html = renderValuationPayoff(BASE);

    expect(html).toContain("Then: your baseline valuation");
    // No leading "5." — the count belongs to the four derived checkpoints.
    expect(html).not.toMatch(/>\s*5\./);
  });

  it("contains no em or en dashes in outward-facing copy", () => {
    const html = renderValuationPayoff(BASE);

    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });
});
