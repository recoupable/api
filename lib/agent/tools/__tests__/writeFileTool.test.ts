import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeFileTool } from "@/lib/agent/tools/writeFileTool";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(),
}));

const ctx = { sandbox: { state: { sandboxName: "x" }, workingDirectory: "/sandbox/mono" } };

function makeSandbox(over: Record<string, unknown> = {}) {
  return {
    workingDirectory: "/sandbox/mono",
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi
      .fn()
      .mockResolvedValue({ size: 42, mtimeMs: 0, isDirectory: () => false, isFile: () => true }),
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("writeFileTool", () => {
  it("creates parent dirs and writes content via sandbox.writeFile", async () => {
    const sb = makeSandbox();
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = writeFileTool();
    const result = (await tool.execute!({ filePath: "src/index.ts", content: "export {}" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; path: string; bytesWritten: number };
    expect(result.success).toBe(true);
    expect(result.path).toBe("src/index.ts");
    expect(result.bytesWritten).toBe(42);
    expect(sb.mkdir).toHaveBeenCalledWith("/sandbox/mono/src", { recursive: true });
    expect(sb.writeFile).toHaveBeenCalledWith("/sandbox/mono/src/index.ts", "export {}", "utf-8");
  });

  it("returns success:false on sandbox failure", async () => {
    const sb = makeSandbox({
      writeFile: vi.fn().mockRejectedValue(new Error("EACCES")),
    });
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = writeFileTool();
    const result = (await tool.execute!({ filePath: "a.ts", content: "x" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/EACCES/);
  });
});
