import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProjectSkillDirectories,
  getGlobalSkillsDirectory,
  getSandboxSkillDirectories,
} from "@/lib/skills/getSandboxSkillDirectories";
import { resolveSandboxHomeDirectory } from "@/lib/sandbox/resolveSandboxHomeDirectory";

vi.mock("@/lib/sandbox/resolveSandboxHomeDirectory", () => ({
  resolveSandboxHomeDirectory: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("getProjectSkillDirectories", () => {
  it("returns .claude/skills and .agents/skills under the workdir", () => {
    expect(getProjectSkillDirectories("/sandbox/mono")).toEqual([
      "/sandbox/mono/.claude/skills",
      "/sandbox/mono/.agents/skills",
    ]);
  });
});

describe("getGlobalSkillsDirectory", () => {
  it("returns <home>/.agents/skills", () => {
    expect(getGlobalSkillsDirectory("/root")).toBe("/root/.agents/skills");
    expect(getGlobalSkillsDirectory("/home/sandbox")).toBe("/home/sandbox/.agents/skills");
  });
});

describe("getSandboxSkillDirectories", () => {
  it("returns the 3-path layout (2 project + 1 global) using resolved $HOME", async () => {
    vi.mocked(resolveSandboxHomeDirectory).mockResolvedValue("/root");
    const dirs = await getSandboxSkillDirectories({ workingDirectory: "/sandbox/mono" } as never);
    expect(dirs).toEqual([
      "/sandbox/mono/.claude/skills",
      "/sandbox/mono/.agents/skills",
      "/root/.agents/skills",
    ]);
  });

  it("uses whatever $HOME the sandbox probe returns", async () => {
    vi.mocked(resolveSandboxHomeDirectory).mockResolvedValue("/home/vercel-sandbox");
    const dirs = await getSandboxSkillDirectories({ workingDirectory: "/work" } as never);
    expect(dirs[2]).toBe("/home/vercel-sandbox/.agents/skills");
  });
});
