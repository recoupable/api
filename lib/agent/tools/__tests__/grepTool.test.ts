import { describe, it, expect, vi, beforeEach } from "vitest";
import { grepTool } from "@/lib/agent/tools/grepTool";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(),
}));

const ctx = { sandbox: { state: { sandboxName: "x" }, workingDirectory: "/sandbox/mono" } };

function makeSandbox(exec: ReturnType<typeof vi.fn>) {
  return { workingDirectory: "/sandbox/mono", exec };
}

beforeEach(() => vi.clearAllMocks());

describe("grepTool", () => {
  it("parses `file:line:content` output into structured matches", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout:
          "/sandbox/mono/src/a.ts:5:export function login() {\n/sandbox/mono/src/a.ts:42:  login();\n/sandbox/mono/src/b.ts:7:login()",
        stderr: "",
        truncated: false,
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = grepTool;
    const result = (await tool.execute!({ pattern: "login", path: "src" }, {
      context: ctx,
    } as never)) as {
      success: boolean;
      matches: Array<{ file: string; line: number; content: string }>;
      filesWithMatches: number;
    };
    expect(result.success).toBe(true);
    expect(result.matches).toHaveLength(3);
    expect(result.matches[0]).toEqual({
      file: "src/a.ts",
      line: 5,
      content: "export function login() {",
    });
    expect(result.filesWithMatches).toBe(2);
  });

  it("treats exit code 1 (no matches) as success:true with empty matches", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: false,
        exitCode: 1,
        stdout: "",
        stderr: "",
        truncated: false,
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = grepTool;
    const result = (await tool.execute!({ pattern: "nothing", path: "src" }, {
      context: ctx,
    } as never)) as { success: boolean; matchCount: number };
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(0);
  });

  it("returns success:false for real grep errors (non-1 exit)", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: false,
        exitCode: 2,
        stdout: "",
        stderr: "grep: invalid regex",
        truncated: false,
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const tool = grepTool;
    const result = (await tool.execute!({ pattern: "[", path: "src" }, {
      context: ctx,
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid regex/);
  });

  it("passes -i for caseSensitive:false", async () => {
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
    const tool = grepTool;
    await tool.execute!({ pattern: "x", path: ".", caseSensitive: false }, {
      context: ctx,
    } as never);
    expect(sb.exec.mock.calls[0]?.[0]).toContain(" -i ");
  });
});
