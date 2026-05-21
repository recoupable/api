import { describe, it, expect } from "vitest";
import { buildAgentTools } from "@/lib/agent/buildAgentTools";

const EXPECTED_TOOL_NAMES = [
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
  it("returns a tools record with all 8 leaf tools registered", () => {
    const tools = buildAgentTools();
    for (const name of EXPECTED_TOOL_NAMES) {
      expect(tools).toHaveProperty(name);
    }
  });

  it("each tool exposes the AI SDK shape (description + inputSchema + execute)", () => {
    const tools = buildAgentTools() as Record<
      string,
      { description?: unknown; inputSchema?: unknown; execute?: unknown }
    >;
    for (const name of EXPECTED_TOOL_NAMES) {
      const t = tools[name]!;
      expect(typeof t.description).toBe("string");
      expect(t.inputSchema).toBeDefined();
      expect(typeof t.execute).toBe("function");
    }
  });
});
