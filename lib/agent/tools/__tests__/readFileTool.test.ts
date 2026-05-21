import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileTool } from "@/lib/agent/tools/readFileTool";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(),
}));

const ctx = {
  sandbox: { state: { sandboxName: "x" }, workingDirectory: "/sandbox/mono" },
};

function makeSandbox(over: Record<string, unknown> = {}) {
  return {
    workingDirectory: "/sandbox/mono",
    stat: vi.fn(),
    readFile: vi.fn(),
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("readFileTool", () => {
  it("reads a file and returns numbered lines", async () => {
    const sb = makeSandbox({
      stat: vi
        .fn()
        .mockResolvedValue({ isDirectory: () => false, isFile: () => true, size: 10, mtimeMs: 0 }),
      readFile: vi.fn().mockResolvedValue("line one\nline two\nline three"),
    });
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = readFileTool();
    const result = (await tool.execute!({ filePath: "README.md" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; content: string; totalLines: number; path: string };
    expect(result.success).toBe(true);
    expect(result.totalLines).toBe(3);
    expect(result.content).toBe("1: line one\n2: line two\n3: line three");
    expect(result.path).toBe("README.md");
  });

  it("honors offset + limit (1-indexed)", async () => {
    const sb = makeSandbox({
      stat: vi
        .fn()
        .mockResolvedValue({ isDirectory: () => false, isFile: () => true, size: 0, mtimeMs: 0 }),
      readFile: vi.fn().mockResolvedValue("a\nb\nc\nd\ne"),
    });
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = readFileTool();
    const result = (await tool.execute!({ filePath: "x.txt", offset: 2, limit: 2 }, {
      experimental_context: ctx,
    } as never)) as { content: string; startLine: number; endLine: number };
    expect(result.startLine).toBe(2);
    // `endLine` is the last line included (1-indexed). With offset=2,limit=2
    // we read lines 2 + 3 of a 5-line file, so endLine=3.
    expect(result.endLine).toBe(3);
    expect(result.content).toBe("2: b\n3: c");
  });

  it("rejects directories", async () => {
    const sb = makeSandbox({
      stat: vi
        .fn()
        .mockResolvedValue({ isDirectory: () => true, isFile: () => false, size: 0, mtimeMs: 0 }),
    });
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = readFileTool();
    const result = (await tool.execute!({ filePath: "src" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/directory/i);
  });

  it("returns success:false with an error string on stat/readFile failure", async () => {
    const sb = makeSandbox({
      stat: vi.fn().mockRejectedValue(new Error("not found")),
    });
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = readFileTool();
    const result = (await tool.execute!({ filePath: "missing.ts" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/);
  });
});
