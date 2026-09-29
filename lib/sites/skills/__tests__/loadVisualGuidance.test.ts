import { expect, it } from "vitest";
import { loadVisualGuidance } from "../loadVisualGuidance";
it("loads the requested craft chapter and exact examples with provenance", () => {
  const loaded = loadVisualGuidance("motion-recipes", [2, 30]);
  expect(loaded.topic).toBe("motion-recipes");
  expect(loaded.guidance).toContain("motion");
  expect(loaded.references.map(r => r.id)).toEqual([2, 30]);
  expect(loaded.references[0].content).toContain("https://x.com/");
  expect(loaded.sourceHash).toMatch(/^[a-f0-9]{64}$/);
});
it("rejects unavailable topics and references rather than silently inventing guidance", () => {
  expect(() => loadVisualGuidance("missing", [2])).toThrow("Unknown visual topic");
  expect(() => loadVisualGuidance("principles", [999])).toThrow("Unknown visual reference");
});
