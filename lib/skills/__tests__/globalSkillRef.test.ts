import { describe, it, expect } from "vitest";
import {
  globalSkillRefSchema,
  globalSkillRefsSchema,
  normalizeGlobalSkillRefs,
} from "@/lib/skills/globalSkillRef";

describe("globalSkillRefSchema", () => {
  it("accepts a valid owner/repo + skillName ref", () => {
    const result = globalSkillRefSchema.safeParse({
      source: "recoupable/skills",
      skillName: "recoup-api",
    });
    expect(result.success).toBe(true);
  });

  it("rejects sources that aren't owner/repo format", () => {
    expect(globalSkillRefSchema.safeParse({ source: "recoupable", skillName: "x" }).success).toBe(
      false,
    );
    expect(globalSkillRefSchema.safeParse({ source: "a/b/c", skillName: "x" }).success).toBe(false);
  });

  it("rejects skill names with whitespace", () => {
    expect(globalSkillRefSchema.safeParse({ source: "a/b", skillName: "two words" }).success).toBe(
      false,
    );
  });
});

describe("globalSkillRefsSchema dedup transform", () => {
  it("removes duplicates by case-insensitive (source, skillName) key", () => {
    const result = globalSkillRefsSchema.parse([
      { source: "recoupable/skills", skillName: "recoup-api" },
      { source: "Recoupable/Skills", skillName: "RECOUP-API" },
      { source: "recoupable/skills", skillName: "artist-workspace" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].skillName).toBe("recoup-api");
    expect(result[1].skillName).toBe("artist-workspace");
  });
});

describe("normalizeGlobalSkillRefs", () => {
  it("returns [] for invalid input instead of throwing", () => {
    expect(normalizeGlobalSkillRefs(null)).toEqual([]);
    expect(normalizeGlobalSkillRefs("not an array")).toEqual([]);
    expect(normalizeGlobalSkillRefs([{ bad: "shape" }])).toEqual([]);
  });

  it("returns valid + deduped refs on the happy path", () => {
    const refs = normalizeGlobalSkillRefs([
      { source: "a/b", skillName: "x" },
      { source: "a/b", skillName: "x" },
    ]);
    expect(refs).toHaveLength(1);
  });
});
