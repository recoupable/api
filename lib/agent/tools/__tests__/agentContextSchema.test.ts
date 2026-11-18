import { describe, expect, it } from "vitest";
import { buildAgentTools } from "../../buildAgentTools";
import { asSchema } from "ai";

describe("server tool context declarations", () => {
  it.each(["bash", "read", "write", "edit", "grep", "glob", "web_fetch", "task"] as const)(
    "%s declares and validates context separately from model input",
    async name => {
      const tools = buildAgentTools();
      const schema = tools[name].contextSchema;
      expect(schema).toBeDefined();
      const validated = await asSchema(schema!).validate!({ sandbox: null });
      expect(validated.success).toBe(false);
    },
  );
});
