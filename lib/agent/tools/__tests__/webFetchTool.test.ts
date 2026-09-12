import { describe, it, expect, vi, beforeEach } from "vitest";
import { webFetchTool, MAX_BODY_LENGTH } from "@/lib/agent/tools/webFetchTool";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(),
}));

const ctx = { sandbox: { state: { sandboxName: "x" }, workingDirectory: "/sandbox/mono" } };

function makeSandbox(exec: ReturnType<typeof vi.fn>) {
  return { workingDirectory: "/sandbox/mono", exec };
}

/** The tool's stdout contract: `status\nbyteSize\n<body>`. */
function stdout(status: string, size: number, body: string) {
  return `${status}\n${size}\n${body}`;
}

beforeEach(() => vi.clearAllMocks());

describe("webFetchTool", () => {
  it("parses status, size and body on success", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: stdout("200", 11, '{"ok":true}'),
        stderr: "",
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

  it("preserves a body that itself contains newlines", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: stdout("200", 13, "line1\nline2\n"),
        stderr: "",
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const result = (await webFetchTool.execute!({ url: "https://example.com/multiline" }, {
      experimental_context: ctx,
    } as never)) as { body: string };
    expect(result.body).toBe("line1\nline2\n");
  });

  it("marks truncated by BYTE SIZE, not by exit code", async () => {
    const big = MAX_BODY_LENGTH + 512;
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: stdout("200", big, "x".repeat(MAX_BODY_LENGTH)),
        stderr: "",
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const result = (await webFetchTool.execute!({ url: "https://example.com/huge" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; truncated: boolean; body: string };
    expect(result.success).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.body.length).toBe(MAX_BODY_LENGTH);
  });

  // The regression this fix exists for (chat#1918): a zero-byte write must never be
  // reported as a truncated success — that made agents believe every URL was empty.
  it("returns success:false when curl exits 23 with an empty body", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: false,
        exitCode: 23,
        stdout: stdout("200", 0, ""),
        stderr: "curl: (23) Failure writing output to destination",
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const result = (await webFetchTool.execute!({ url: "https://example.com" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/23|writing output/i);
  });

  it("returns success:false on any nonzero exit with an empty body", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: false,
        exitCode: 7,
        stdout: stdout("000", 0, ""),
        stderr: "Failed to connect",
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    const result = (await webFetchTool.execute!({ url: "https://example.com/unreachable" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Failed to connect/);
  });

  it("does not use bash process substitution (unsupported in the sandbox shell)", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: stdout("200", 2, "ok"),
        stderr: "",
      }),
    );
    vi.mocked(connectVercel).mockResolvedValue(sb as never);
    await webFetchTool.execute!({ url: "https://example.com" }, {
      experimental_context: ctx,
    } as never);
    const cmd = sb.exec.mock.calls[0]?.[0] as string;
    expect(cmd).not.toContain(">(");
    expect(cmd).not.toContain(">&3");
    expect(cmd).toContain("mktemp");
  });

  it("passes the request body for POST", async () => {
    const sb = makeSandbox(
      vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: stdout("201", 2, "ok"),
        stderr: "",
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
