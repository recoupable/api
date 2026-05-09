import { describe, it, expect, vi, beforeEach } from "vitest";
import { installGlobalSkills } from "@/lib/skills/installGlobalSkills";
import { resolveSandboxHomeDirectory } from "@/lib/sandbox/resolveSandboxHomeDirectory";

vi.mock("@/lib/sandbox/resolveSandboxHomeDirectory", () => ({
  resolveSandboxHomeDirectory: vi.fn(async () => "/home/agent"),
}));

const exec = vi.fn();
const sandbox = {
  workingDirectory: "/workspace",
  exec,
} as never;

const REF_API = { source: "recoupable/skills", skillName: "recoup-api" };
const REF_WORKSPACE = { source: "recoupable/skills", skillName: "artist-workspace" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveSandboxHomeDirectory).mockResolvedValue("/home/agent");
  exec.mockResolvedValue({
    success: true,
    exitCode: 0,
    stdout: "",
    stderr: "",
    truncated: false,
  });
});

describe("installGlobalSkills", () => {
  it("returns immediately when given an empty list", async () => {
    await installGlobalSkills({ sandbox, globalSkillRefs: [] });
    expect(exec).not.toHaveBeenCalled();
  });

  it("runs `npx skills add` once per ref, with the resolved HOME", async () => {
    await installGlobalSkills({ sandbox, globalSkillRefs: [REF_API, REF_WORKSPACE] });

    expect(exec).toHaveBeenCalledTimes(2);
    expect(exec.mock.calls[0][0]).toContain("HOME='/home/agent'");
    expect(exec.mock.calls[0][0]).toContain(
      "npx skills add 'recoupable/skills' --skill 'recoup-api'",
    );
    expect(exec.mock.calls[1][0]).toContain("--skill 'artist-workspace'");
  });

  it("dedupes duplicate refs via the schema before installing", async () => {
    await installGlobalSkills({
      sandbox,
      globalSkillRefs: [REF_API, REF_API],
    });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("throws when any install command fails", async () => {
    exec.mockResolvedValueOnce({
      success: false,
      exitCode: 1,
      stdout: "",
      stderr: "package not found",
      truncated: false,
    });

    await expect(installGlobalSkills({ sandbox, globalSkillRefs: [REF_API] })).rejects.toThrow(
      /package not found/,
    );
  });
});
