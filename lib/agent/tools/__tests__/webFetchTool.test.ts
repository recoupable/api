import { describe, it, expect, vi, beforeEach } from "vitest";
import { webFetchTool } from "@/lib/agent/tools/webFetchTool";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(),
}));

const ctx = { sandbox: { state: { sandboxName: "x" }, workingDirectory: "/sandbox/mono" } };

function makeSandbox(exec: ReturnType<typeof vi.fn>) {
  return { workingDirectory: "/sandbox/mono", exec };
}

beforeEach(() => vi.clearAllMocks());

describe("webFetchTool", () => {
  it("parses body + trailing status code on success", async () => {
    // Body, then newline, then status code "200" (per the curl -w '%{http_code}' contract).
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: '{"ok":true}\n200',
        stderr: "",
        truncated: false,
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const result = (await webFetchTool.execute!({ url: "https://example.com/api" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; status: number; body: string; truncated: boolean };
    expect(result).toEqual({
      success: true,
      status: 200,
      body: '{"ok":true}',
      truncated: false,
    });
  });

  it("marks truncated:true on curl exit 23 (head -c cut off the body)", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: false,
        exitCode: 23,
        stdout: "huge body fragment\n200",
        stderr: "",
        truncated: false,
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const result = (await webFetchTool.execute!({ url: "https://example.com/huge" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; truncated: boolean };
    expect(result.success).toBe(true);
    expect(result.truncated).toBe(true);
  });

  it("returns success:false on non-0, non-23 curl exit", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: false,
        exitCode: 7,
        stdout: "",
        stderr: "Failed to connect",
        truncated: false,
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const result = (await webFetchTool.execute!({ url: "https://example.com/unreachable" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Failed to connect/);
  });

  it("passes the request body for POST", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: "ok\n201",
        stderr: "",
        truncated: false,
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    await webFetchTool.execute!(
      { url: "https://example.com/api", method: "POST", body: '{"x":1}' },
      { experimental_context: ctx } as never,
    );
    const cmd = sb.exec.mock.calls[0]?.[0] as string;
    expect(cmd).toContain("-X POST");
    expect(cmd).toContain("-d '{\"x\":1}'");
  });
});
