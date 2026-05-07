import { describe, it, expect } from "vitest";
import { DEFAULT_GLOBAL_SKILL_REFS } from "@/lib/skills/defaultGlobalSkillRefs";

describe("DEFAULT_GLOBAL_SKILL_REFS", () => {
  it("ships recoup-api and artist-workspace as platform defaults", () => {
    const sourceNames = DEFAULT_GLOBAL_SKILL_REFS.map(r => `${r.source}::${r.skillName}`);
    expect(sourceNames).toContain("recoupable/skills::recoup-api");
    expect(sourceNames).toContain("recoupable/skills::artist-workspace");
  });

  it("only references the recoupable/skills source", () => {
    expect(DEFAULT_GLOBAL_SKILL_REFS.every(r => r.source === "recoupable/skills")).toBe(true);
  });
});
