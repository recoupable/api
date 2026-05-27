import { describe, it, expect } from "vitest";
import { parseSkillFrontmatter } from "@/lib/skills/parseSkillFrontmatter";

describe("parseSkillFrontmatter", () => {
  it("parses a minimal frontmatter (name + description)", () => {
    const md = `---\nname: commit\ndescription: Make a git commit\n---\n\nBody.`;
    const result = parseSkillFrontmatter(md);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe("commit");
    expect(result.data.description).toBe("Make a git commit");
  });

  it("unwraps double-quoted values (including escaped quotes)", () => {
    const md = `---\nname: foo\ndescription: "Has \\"quotes\\" inside"\n---\nbody`;
    const result = parseSkillFrontmatter(md);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.description).toBe('Has "quotes" inside');
  });

  it("parses booleans for unquoted true/false", () => {
    const md = `---\nname: foo\ndescription: bar\ndisable-model-invocation: true\nuser-invocable: false\n---\nbody`;
    const result = parseSkillFrontmatter(md);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data["disable-model-invocation"]).toBe(true);
    expect(result.data["user-invocable"]).toBe(false);
  });

  it("treats `true`/`false` inside quotes as strings (not booleans)", () => {
    const md = `---\nname: foo\ndescription: "true"\n---\nbody`;
    const result = parseSkillFrontmatter(md);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.description).toBe("true");
  });

  it("returns success:false when frontmatter is missing", () => {
    const result = parseSkillFrontmatter("just markdown, no frontmatter");
    expect(result.success).toBe(false);
  });

  it("returns success:false when required fields are absent", () => {
    const result = parseSkillFrontmatter(`---\nname: only-name\n---\nbody`);
    expect(result.success).toBe(false);
  });

  it("preserves colons in values (e.g. URLs)", () => {
    const md = `---\nname: foo\ndescription: see https://example.com\n---\nbody`;
    const result = parseSkillFrontmatter(md);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.description).toBe("see https://example.com");
  });
});
