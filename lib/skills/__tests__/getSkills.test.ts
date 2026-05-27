import { describe, it, expect } from "vitest";
import { getSkills } from "@/lib/skills/getSkills";

const validCtx = {
  sandbox: { state: { sandboxName: "x" }, workingDirectory: "/sandbox/mono" },
};

const sample = {
  name: "recoup-api",
  description: "Recoupable API skill",
  path: "/home/vercel-sandbox/.agents/skills/recoup-api",
  filename: "SKILL.md",
  options: {},
};

describe("getSkills", () => {
  it("returns the skills array when present in a valid AgentContext", () => {
    expect(getSkills({ ...validCtx, skills: [sample] })).toEqual([sample]);
  });

  it("returns [] when no skills field is set", () => {
    expect(getSkills(validCtx)).toEqual([]);
  });

  it("returns [] for malformed contexts (non-AgentContext shape)", () => {
    expect(getSkills(undefined)).toEqual([]);
    expect(getSkills(null)).toEqual([]);
    expect(getSkills({ noSandbox: true })).toEqual([]);
    expect(getSkills({ sandbox: null })).toEqual([]);
  });
});
