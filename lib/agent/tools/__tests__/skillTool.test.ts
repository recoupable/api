import { describe, it, expect, vi, beforeEach } from "vitest";
import { skillTool } from "@/lib/agent/tools/skillTool";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(),
}));

const baseCtx = {
  sandbox: { state: { sandboxName: "x" }, workingDirectory: "/sandbox/mono" },
};

function makeSandbox(readFile: ReturnType<typeof vi.fn>) {
  return { workingDirectory: "/sandbox/mono", readFile };
}

function skillMd(body: string) {
  return `---\nname: commit\ndescription: Make a commit\n---\n\n${body}`;
}

beforeEach(() => vi.clearAllMocks());

describe("skillTool", () => {
  it("returns success:false with available skills when the requested skill isn't in context", async () => {
    vi.mocked(connectVercel).mockResolvedValue(makeSandbox(vi.fn()) as never);
    const result = (await skillTool.execute!({ skill: "unknown" }, {
      context: {
        ...baseCtx,
        skills: [
          {
            name: "commit",
            description: "Make a commit",
            path: "/sandbox/mono/skills/commit",
            filename: "SKILL.md",
            options: {},
          },
          {
            name: "deploy",
            description: "Deploy",
            path: "/sandbox/mono/skills/deploy",
            filename: "SKILL.md",
            options: {},
          },
        ],
      },
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Available skills: commit, deploy/);
  });

  it("returns success:false when no skills are loaded", async () => {
    vi.mocked(connectVercel).mockResolvedValue(makeSandbox(vi.fn()) as never);
    const result = (await skillTool.execute!({ skill: "commit" }, {
      context: { ...baseCtx, skills: [] },
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Available skills: none/);
  });

  it("matches the skill name case-insensitively (slash-command behavior)", async () => {
    const sb = makeSandbox(vi.fn().mockResolvedValue(skillMd("body content")));
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const result = (await skillTool.execute!(
      { skill: "COMMIT" }, // model typed it loud
      {
        context: {
          ...baseCtx,
          skills: [
            {
              name: "commit",
              description: "x",
              path: "/sandbox/mono/skills/commit",
              filename: "SKILL.md",
              options: {},
            },
          ],
        },
      } as never,
    )) as { success: boolean; skillName: string };
    expect(result.success).toBe(true);
    expect(result.skillName).toBe("COMMIT");
  });

  it("returns the SKILL.md body with skill directory injected", async () => {
    const sb = makeSandbox(vi.fn().mockResolvedValue(skillMd("Run git commit -m ...")));
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const result = (await skillTool.execute!({ skill: "commit" }, {
      context: {
        ...baseCtx,
        skills: [
          {
            name: "commit",
            description: "x",
            path: "/sandbox/mono/skills/commit",
            filename: "SKILL.md",
            options: {},
          },
        ],
      },
    } as never)) as { success: boolean; content: string; skillPath: string };
    expect(result.success).toBe(true);
    expect(result.skillPath).toBe("/sandbox/mono/skills/commit");
    expect(result.content).toContain("Skill directory: /sandbox/mono/skills/commit");
    expect(result.content).toContain("Run git commit -m ...");
    expect(sb.readFile).toHaveBeenCalledWith("/sandbox/mono/skills/commit/SKILL.md", "utf-8");
  });

  it("substitutes $ARGUMENTS in the skill body when args are provided", async () => {
    const sb = makeSandbox(vi.fn().mockResolvedValue(skillMd('git commit -m "$ARGUMENTS"')));
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const result = (await skillTool.execute!({ skill: "commit", args: "fix bug" }, {
      context: {
        ...baseCtx,
        skills: [
          {
            name: "commit",
            description: "x",
            path: "/sandbox/mono/skills/commit",
            filename: "SKILL.md",
            options: {},
          },
        ],
      },
    } as never)) as { content: string };
    expect(result.content).toContain('git commit -m "fix bug"');
    expect(result.content).not.toContain("$ARGUMENTS");
  });

  it("rejects skills with disable-model-invocation set", async () => {
    vi.mocked(connectVercel).mockResolvedValue(makeSandbox(vi.fn()) as never);
    const result = (await skillTool.execute!({ skill: "internal" }, {
      context: {
        ...baseCtx,
        skills: [
          {
            name: "internal",
            description: "x",
            path: "/sandbox/mono/skills/internal",
            filename: "SKILL.md",
            options: { disableModelInvocation: true },
          },
        ],
      },
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cannot be invoked/);
  });

  it("returns success:false when the SKILL.md read fails", async () => {
    const sb = makeSandbox(vi.fn().mockRejectedValue(new Error("ENOENT")));
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const result = (await skillTool.execute!({ skill: "commit" }, {
      context: {
        ...baseCtx,
        skills: [
          {
            name: "commit",
            description: "x",
            path: "/sandbox/mono/skills/commit",
            filename: "SKILL.md",
            options: {},
          },
        ],
      },
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ENOENT/);
  });
});
