import { afterEach, expect, it, vi } from "vitest";
import { getSiteModelOptions } from "../getSiteModelOptions";
afterEach(() => vi.unstubAllEnvs());
it("uses Opus 5.5 with high adaptive thinking for the Sites experiment", () => {
  vi.stubEnv("SITES_MODEL", "");
  expect(getSiteModelOptions()).toEqual({
    model: "anthropic/claude-opus-5.5",
    maxOutputTokens: 32768,
    providerOptions: { anthropic: { thinking: { type: "adaptive" }, effort: "high" } },
  });
});
it("preserves an explicit alternate model without incompatible provider options", () => {
  vi.stubEnv("SITES_MODEL", "openai/gpt-6-astra");
  expect(getSiteModelOptions()).toEqual({ model: "openai/gpt-6-astra" });
});
