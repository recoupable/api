import { describe, it, expect } from "vitest";
import { getGlobalSkillsDirectory } from "@/lib/skills/getGlobalSkillsDirectory";

describe("getGlobalSkillsDirectory", () => {
  it("returns <home>/.agents/skills", () => {
    expect(getGlobalSkillsDirectory("/root")).toBe("/root/.agents/skills");
    expect(getGlobalSkillsDirectory("/home/vercel-sandbox")).toBe(
      "/home/vercel-sandbox/.agents/skills",
    );
  });

  it("handles trailing slash on input", () => {
    expect(getGlobalSkillsDirectory("/root/")).toBe("/root/.agents/skills");
  });
});
