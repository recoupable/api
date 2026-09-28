import { expect, it } from "vitest";
import { loadSiteSkill } from "../loadSiteSkill";
it("loads the pinned skill with selected references and rejects unavailable references", () => {
  const result = loadSiteSkill([1, 2]);
  expect(result.skill).toContain("Build a worthwhile interactive site");
  expect(result.references.map(r => r.id)).toEqual([1, 2]);
  expect(result.revision).toMatch(/^[a-f0-9]{40}$/);
  expect(() => loadSiteSkill([999])).toThrow("Unknown site reference");
});
