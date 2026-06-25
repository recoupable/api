import { describe, it, expect } from "vitest";
import { DEFAULT_GLOBAL_SKILL_REFS } from "@/lib/skills/defaultGlobalSkillRefs";

describe("DEFAULT_GLOBAL_SKILL_REFS", () => {
  it("ships the current recoupable/skills slugs (post-rename) as platform defaults", () => {
    const sourceNames = DEFAULT_GLOBAL_SKILL_REFS.map(r => `${r.source}::${r.skillName}`);
    expect(sourceNames).toContain("recoupable/skills::recoup-platform-api-access");
    expect(sourceNames).toContain("recoupable/skills::recoup-platform-build-workspace");
    expect(sourceNames).toContain("recoupable/skills::recoup-roster-add-artist");
    expect(sourceNames).toContain("recoupable/skills::recoup-roster-list-artists");
    expect(sourceNames).toContain("recoupable/skills::recoup-roster-manage-artist");
  });

  it("does not reference the legacy pre-rename names", () => {
    const names = DEFAULT_GLOBAL_SKILL_REFS.map(r => r.skillName);
    expect(names).not.toContain("recoup-api");
    expect(names).not.toContain("artist-workspace");
  });

  it("only references the recoupable/skills source", () => {
    expect(DEFAULT_GLOBAL_SKILL_REFS.every(r => r.source === "recoupable/skills")).toBe(true);
  });
});
