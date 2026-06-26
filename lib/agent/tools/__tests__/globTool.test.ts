import { describe, it, expect, vi, beforeEach } from "vitest";
import { globTool } from "@/lib/agent/tools/globTool";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(),
}));

const ctx = { sandbox: { state: { sandboxName: "x" }, workingDirectory: "/sandbox/mono" } };

function makeSandbox(exec: ReturnType<typeof vi.fn>) {
  return { workingDirectory: "/sandbox/mono", exec };
}

beforeEach(() => vi.clearAllMocks());

describe("globTool", () => {
  it("parses `mtime\\tsize\\tpath` output into structured file entries", async () => {
    // Two files, newest first (sort already happens server-side in the command).
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout:
          "1700000000.0\t512\t/sandbox/mono/src/index.ts\n1699999000.5\t256\t/sandbox/mono/src/util.ts",
        stderr: "",
        truncated: false,
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = globTool;
    const result = (await tool.execute!({ pattern: "**/*.ts" }, {
      context: ctx,
    } as never)) as {
      success: boolean;
      count: number;
      files: Array<{ path: string; size: number; modifiedAt: string }>;
    };
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.files[0]?.path).toBe("src/index.ts");
    expect(result.files[0]?.size).toBe(512);
    expect(typeof result.files[0]?.modifiedAt).toBe("string"); // ISO
  });

  it("emits a recursive find (no -maxdepth) for `**/*.ts`", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: "",
        stderr: "",
        truncated: false,
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = globTool;
    await tool.execute!({ pattern: "**/*.ts" }, { context: ctx } as never);
    const cmd = sb.exec.mock.calls[0]?.[0] as string;
    expect(cmd).not.toContain("-maxdepth");
  });

  it("emits -maxdepth 1 for a bare `*.json` pattern (no recursion)", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: "",
        stderr: "",
        truncated: false,
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = globTool;
    await tool.execute!({ pattern: "*.json" }, { context: ctx } as never);
    expect(sb.exec.mock.calls[0]?.[0]).toMatch(/-maxdepth\s+1/);
  });

  it("returns success:false on non-1 exit codes", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: false,
        exitCode: 2,
        stdout: "err",
        stderr: "",
        truncated: false,
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = globTool;
    const result = (await tool.execute!({ pattern: "**/*.ts" }, {
      context: ctx,
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exit 2/);
  });
});
