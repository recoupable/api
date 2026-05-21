import { describe, it, expect } from "vitest";
import { todoWriteTool } from "@/lib/agent/tools/todoWriteTool";

describe("todoWriteTool", () => {
  it("echoes the todos back with a count message", async () => {
    const todos = [
      { id: "1", content: "ls the workspace", status: "in_progress" as const },
      { id: "2", content: "summarize what we found", status: "pending" as const },
    ];
    const result = (await todoWriteTool.execute!({ todos }, {} as never)) as {
      success: boolean;
      message: string;
      todos: typeof todos;
    };
    expect(result.success).toBe(true);
    expect(result.message).toBe("Updated task list with 2 items");
    expect(result.todos).toEqual(todos);
  });

  it("accepts an empty list", async () => {
    const result = (await todoWriteTool.execute!({ todos: [] }, {} as never)) as {
      success: boolean;
      message: string;
    };
    expect(result.success).toBe(true);
    expect(result.message).toBe("Updated task list with 0 items");
  });
});
