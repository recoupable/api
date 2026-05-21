import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getGlobalSkillsDirectory,
  getSandboxSkillDirectories,
} from "@/lib/skills/getSandboxSkillDirectories";
import { resolveSandboxHomeDirectory } from "@/lib/sandbox/resolveSandboxHomeDirectory";

vi.mock("@/lib/sandbox/resolveSandboxHomeDirectory", () => ({
  resolveSandboxHomeDirectory: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("getGlobalSkillsDirectory", () => {
  it("returns <home>/.agents/skills", () => {
    expect(getGlobalSkillsDirectory("/root")).toBe("/root/.agents/skills");
    expect(getGlobalSkillsDirectory("/home/vercel-sandbox")).toBe(
      "/home/vercel-sandbox/.agents/skills",
    );
  });
});

describe("getSandboxSkillDirectories", () => {
  it("returns just the global skill dir under the resolved $HOME", async () => {
    vi.mocked(resolveSandboxHomeDirectory).mockResolvedValue("/home/vercel-sandbox");
    const dirs = await getSandboxSkillDirectories({ workingDirectory: "/sandbox/mono" } as never);
    expect(dirs).toEqual(["/home/vercel-sandbox/.agents/skills"]);
  });

  it("works with the /root fallback (open-agents base image)", async () => {
    vi.mocked(resolveSandboxHomeDirectory).mockResolvedValue("/root");
    const dirs = await getSandboxSkillDirectories({ workingDirectory: "/x" } as never);
    expect(dirs).toEqual(["/root/.agents/skills"]);
  });
});
