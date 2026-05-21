import { describe, it, expect } from "vitest";
import { injectSkillDirectory } from "@/lib/skills/injectSkillDirectory";

describe("injectSkillDirectory", () => {
  it("prepends a `Skill directory: <path>` header followed by a blank line", () => {
    expect(injectSkillDirectory("body content", "/skills/foo")).toBe(
      "Skill directory: /skills/foo\n\nbody content",
    );
  });

  it("works with empty body", () => {
    expect(injectSkillDirectory("", "/skills/foo")).toBe("Skill directory: /skills/foo\n\n");
  });
});
