import { expect, it } from "vitest";
import { readVisualMechanisms } from "../readVisualMechanisms";

it("lists the discoverable patterns without loading every implementation", () => {
  const result = readVisualMechanisms({});
  expect(result.catalog.length).toBeGreaterThanOrEqual(102);
  expect(result.patterns).toEqual([]);
  expect(result.catalog[0]).not.toHaveProperty("build");
  expect(result.sourceHash).toMatch(/^[a-f0-9]{64}$/);
});
it("loads selected mechanisms, proof checks and optional reference code", () => {
  const result = readVisualMechanisms({
    patternIds: ["release-momentum"],
    chapter: "diagnosis",
    kernel: "motion",
  });
  expect(result.patterns[0].build.length).toBeGreaterThan(0);
  expect(result.patterns[0].check).toContain("pointercancel");
  expect(result.patterns[0].source_urls[0]).toContain("https://");
  expect(result.guidance).toContain("#");
  expect(result.kernel).toContain("export");
});
it("rejects invented or unsafe resource identifiers", () => {
  expect(() => readVisualMechanisms({ patternIds: ["../secrets"] })).toThrow();
  expect(() => readVisualMechanisms({ chapter: "constructor" })).toThrow();
});
