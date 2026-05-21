import { describe, it, expect, vi, beforeEach } from "vitest";
import { findSkillFile } from "@/lib/skills/findSkillFile";

beforeEach(() => vi.clearAllMocks());

function makeSandbox(existing: string[]) {
  const set = new Set(existing);
  return {
    access: vi.fn(async (p: string) => {
      if (!set.has(p)) throw new Error(`ENOENT: ${p}`);
    }),
  };
}

describe("findSkillFile", () => {
  it("prefers uppercase SKILL.md when both casings exist", async () => {
    const sb = makeSandbox(["/skills/foo/SKILL.md", "/skills/foo/skill.md"]);
    const result = await findSkillFile(sb as never, "/skills/foo");
    expect(result).toBe("/skills/foo/SKILL.md");
    expect(sb.access).toHaveBeenCalledWith("/skills/foo/SKILL.md");
  });

  it("falls back to lowercase skill.md when SKILL.md is missing", async () => {
    const sb = makeSandbox(["/skills/foo/skill.md"]);
    const result = await findSkillFile(sb as never, "/skills/foo");
    expect(result).toBe("/skills/foo/skill.md");
  });

  it("returns null when neither casing exists", async () => {
    const sb = makeSandbox([]);
    const result = await findSkillFile(sb as never, "/skills/foo");
    expect(result).toBeNull();
  });
});
