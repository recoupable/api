import { describe, it, expect, vi, beforeEach } from "vitest";
import { editFileTool } from "@/lib/agent/tools/editFileTool";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(),
}));

const ctx = { sandbox: { state: { sandboxName: "x" }, workingDirectory: "/sandbox/mono" } };

function makeSandbox(initialContent: string) {
  let stored = initialContent;
  return {
    workingDirectory: "/sandbox/mono",
    readFile: vi.fn(async () => stored),
    writeFile: vi.fn(async (_path: string, content: string) => {
      stored = content;
    }),
    getStored: () => stored,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("editFileTool", () => {
  it("replaces a unique oldString once and reports the startLine", async () => {
    const sb = makeSandbox("line one\nold value\nline three");
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = editFileTool();
    const result = (await tool.execute!(
      { filePath: "a.txt", oldString: "old value", newString: "new value" },
      { experimental_context: ctx } as never,
    )) as { success: boolean; replacements: number; startLine: number };
    expect(result.success).toBe(true);
    expect(result.replacements).toBe(1);
    expect(result.startLine).toBe(2);
    expect(sb.getStored()).toBe("line one\nnew value\nline three");
  });

  it("rejects when oldString === newString (no-op)", async () => {
    const sb = makeSandbox("anything");
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = editFileTool();
    const result = (await tool.execute!({ filePath: "a.txt", oldString: "x", newString: "x" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/must be different/);
  });

  it("rejects when oldString is not in the file", async () => {
    const sb = makeSandbox("hello world");
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = editFileTool();
    const result = (await tool.execute!(
      { filePath: "a.txt", oldString: "missing", newString: "other" },
      { experimental_context: ctx } as never,
    )) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it("rejects ambiguous edits (multiple matches without replaceAll)", async () => {
    const sb = makeSandbox("foo\nfoo\nbar");
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = editFileTool();
    const result = (await tool.execute!({ filePath: "a.txt", oldString: "foo", newString: "baz" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/2 times/);
  });

  it("replaces all occurrences when replaceAll:true", async () => {
    const sb = makeSandbox("foo bar foo baz foo");
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = editFileTool();
    const result = (await tool.execute!(
      { filePath: "a.txt", oldString: "foo", newString: "qux", replaceAll: true },
      { experimental_context: ctx } as never,
    )) as { success: boolean; replacements: number };
    expect(result.success).toBe(true);
    expect(result.replacements).toBe(3);
    expect(sb.getStored()).toBe("qux bar qux baz qux");
  });
});
