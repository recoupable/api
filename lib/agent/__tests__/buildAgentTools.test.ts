import { describe, it, expect } from "vitest";
import { buildAgentTools } from "@/lib/agent/buildAgentTools";

const ALWAYS_PRESENT = [
  "bash",
  "read",
  "write",
  "edit",
  "grep",
  "glob",
  "todo_write",
  "web_fetch",
  "task",
  "ask_user_question",
] as const;

describe("buildAgentTools", () => {
  it("registers the 10 always-on tools by default", () => {
    const tools = buildAgentTools();
    for (const name of ALWAYS_PRESENT) {
      expect(tools).toHaveProperty(name);
    }
    expect(tools).not.toHaveProperty("skill");
  });

  it("conditionally adds `skill` when a non-empty skill catalog is provided", () => {
    const tools = buildAgentTools({
      skills: [
        {
          name: "commit",
          description: "Make a commit",
          path: "/sandbox/mono/skills/commit",
          filename: "SKILL.md",
          options: {},
        },
      ],
    });
    expect(tools).toHaveProperty("skill");
    for (const name of ALWAYS_PRESENT) {
      expect(tools).toHaveProperty(name);
    }
  });

  it("omits `skill` when an empty array is passed", () => {
    const tools = buildAgentTools({ skills: [] });
    expect(tools).not.toHaveProperty("skill");
  });

  it("each tool exposes the AI SDK shape (description + inputSchema)", () => {
    const tools = buildAgentTools({
      skills: [
        {
          name: "foo",
          description: "x",
          path: "/p",
          filename: "SKILL.md",
          options: {},
        },
      ],
    }) as Record<string, { description?: unknown; inputSchema?: unknown }>;
    for (const name of [...ALWAYS_PRESENT, "skill"]) {
      const t = tools[name]!;
      expect(typeof t.description).toBe("string");
      expect(t.inputSchema).toBeDefined();
    }
  });

  it("`ask_user_question` has no server execute (client-side tool)", () => {
    const tools = buildAgentTools() as Record<string, { execute?: unknown }>;
    expect(tools.ask_user_question?.execute).toBeUndefined();
  });
});
