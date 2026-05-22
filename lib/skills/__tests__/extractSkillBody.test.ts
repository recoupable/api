import { describe, it, expect } from "vitest";
import { extractSkillBody } from "@/lib/skills/extractSkillBody";

describe("extractSkillBody", () => {
  it("strips YAML frontmatter and returns the body", () => {
    const md = "---\nname: foo\ndescription: bar\n---\n# Heading\n\nBody.";
    expect(extractSkillBody(md)).toBe("# Heading\n\nBody.");
  });

  it("returns the full content when no frontmatter is present", () => {
    expect(extractSkillBody("# Just a heading")).toBe("# Just a heading");
  });

  it("trims surrounding whitespace", () => {
    expect(extractSkillBody("---\nname: x\ndescription: y\n---\n\n\nbody\n\n")).toBe("body");
  });

  it("tolerates Windows-style CRLF line endings", () => {
    const md = "---\r\nname: foo\r\ndescription: bar\r\n---\r\nbody";
    expect(extractSkillBody(md)).toBe("body");
  });
});
