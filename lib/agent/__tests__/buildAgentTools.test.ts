import { describe, it, expect } from "vitest";
import { buildAgentTools } from "@/lib/agent/buildAgentTools";

const BASE_TOOLS = [
  "bash",
  "read",
  "write",
  "edit",
  "grep",
  "glob",
  "todo_write",
  "web_fetch",
] as const;

describe("buildAgentTools", () => {
  it("returns the 8 leaf tools by default (no skill registered when skills list is empty)", () => {
    const tools = buildAgentTools();
    for (const name of BASE_TOOLS) {
      expect(tools).toHaveProperty(name);
    }
    expect(tools).not.toHaveProperty("skill");
  });

  it("registers the skill tool when a non-empty skill catalog is provided", () => {
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
    for (const name of BASE_TOOLS) {
      expect(tools).toHaveProperty(name);
    }
  });

  it("omits the skill tool when an empty array is passed", () => {
    const tools = buildAgentTools({ skills: [] });
    expect(tools).not.toHaveProperty("skill");
  });

  it("each tool exposes the AI SDK shape (description + inputSchema + execute)", () => {
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
    }) as Record<string, { description?: unknown; inputSchema?: unknown; execute?: unknown }>;
    for (const name of [...BASE_TOOLS, "skill"]) {
      const t = tools[name]!;
      expect(typeof t.description).toBe("string");
      expect(t.inputSchema).toBeDefined();
      expect(typeof t.execute).toBe("function");
    }
  });
});
