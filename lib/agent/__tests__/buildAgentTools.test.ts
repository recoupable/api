import { describe, it, expect } from "vitest";
import { buildAgentTools } from "@/lib/agent/buildAgentTools";

describe("buildAgentTools", () => {
  it("returns a tools record keyed by tool name", () => {
    const tools = buildAgentTools();
    expect(tools).toHaveProperty("bash");
    expect(typeof tools.bash).toBe("object");
  });

  it("each tool has an inputSchema, description, and execute", () => {
    const tools = buildAgentTools();
    expect(tools.bash.inputSchema).toBeDefined();
    expect(tools.bash.description).toBeDefined();
    expect(typeof tools.bash.execute).toBe("function");
  });
});
