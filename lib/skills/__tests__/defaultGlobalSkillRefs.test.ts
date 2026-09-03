import { describe, it, expect } from "vitest";
import { DEFAULT_GLOBAL_SKILL_REFS } from "@/lib/skills/defaultGlobalSkillRefs";

describe("DEFAULT_GLOBAL_SKILL_REFS", () => {
  it("ships the current recoupable/skills slugs (post-rename) as platform defaults", () => {
    const sourceNames = DEFAULT_GLOBAL_SKILL_REFS.map(r => `${r.source}::${r.skillName}`);
    expect(sourceNames).toContain("recoupable/skills::recoup-platform-api-access");
    expect(sourceNames).toContain("recoupable/skills::recoup-platform-email-helper");
    expect(sourceNames).toContain("recoupable/skills::recoup-platform-build-os");
    expect(sourceNames).toContain("recoupable/skills::recoup-roster-add-artist");
    expect(sourceNames).toContain("recoupable/skills::recoup-roster-list-artists");
    expect(sourceNames).toContain("recoupable/skills::recoup-roster-manage-artist");
    expect(sourceNames).toContain("recoupable/skills::recoup-music-video");
  });

  // installGlobalSkills runs `npx skills add ... --skill <name>`, which throws
  // on an unknown name — a typo here breaks sandbox creation for every user
  // (recoupable/chat#1815).
  it("uses only published slugs, with no duplicates", () => {
    const names = DEFAULT_GLOBAL_SKILL_REFS.map(r => r.skillName);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every(n => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(n))).toBe(true);
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
