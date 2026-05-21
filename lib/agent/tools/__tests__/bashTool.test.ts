import { describe, it, expect, vi, beforeEach } from "vitest";
import { bashTool, commandNeedsApproval } from "@/lib/agent/tools/bashTool";

import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(),
}));

const baseContext = {
  sandbox: { state: { sandboxName: "session-x" }, workingDirectory: "/sandbox/mono" },
};

function makeSandbox(overrides: Record<string, unknown> = {}) {
  return {
    workingDirectory: "/sandbox/mono",
    exec: vi.fn(),
    execDetached: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("commandNeedsApproval", () => {
  it("flags `rm -rf` as needing approval", () => {
    expect(commandNeedsApproval("rm -rf /")).toBe(true);
    expect(commandNeedsApproval("rm -rf node_modules")).toBe(true);
  });

  it("does not flag safe commands", () => {
    expect(commandNeedsApproval("ls -la")).toBe(false);
    expect(commandNeedsApproval("git status")).toBe(false);
    expect(commandNeedsApproval("npm install")).toBe(false);
  });

  it("trims whitespace before matching", () => {
    expect(commandNeedsApproval("   rm -rf foo  ")).toBe(true);
  });
});

describe("bashTool.execute", () => {
  it("executes a command via sandbox.exec in the sandbox's working directory", async () => {
    const sandbox = makeSandbox({
      exec: vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: "README.md\npackage.json",
        stderr: "",
        truncated: false,
      }),
    });
    vi.mocked(connectVercel).mockResolvedValue(sandbox as never);

    const tool = bashTool();
    const result = await tool.execute!({ command: "ls" }, {
      experimental_context: baseContext,
    } as never);
    expect(result).toEqual({
      success: true,
      exitCode: 0,
      stdout: "README.md\npackage.json",
      stderr: "",
    });
    expect(sandbox.exec).toHaveBeenCalledWith(
      "ls",
      "/sandbox/mono",
      expect.any(Number),
      expect.any(Object),
    );
  });

  it("includes `truncated: true` in the result when sandbox.exec truncated output", async () => {
    const sandbox = makeSandbox({
      exec: vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: "lots of output",
        stderr: "",
        truncated: true,
      }),
    });
    vi.mocked(connectVercel).mockResolvedValue(sandbox as never);

    const tool = bashTool();
    const result = (await tool.execute!({ command: "find ." }, {
      experimental_context: baseContext,
    } as never)) as { truncated?: boolean };
    expect(result.truncated).toBe(true);
  });

  it("resolves a workspace-relative cwd against sandbox.workingDirectory", async () => {
    const sandbox = makeSandbox({
      exec: vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: "",
        stderr: "",
        truncated: false,
      }),
    });
    vi.mocked(connectVercel).mockResolvedValue(sandbox as never);

    const tool = bashTool();
    await tool.execute!({ command: "ls", cwd: "apps/web" }, {
      experimental_context: baseContext,
    } as never);
    expect(sandbox.exec).toHaveBeenCalledWith(
      "ls",
      "/sandbox/mono/apps/web",
      expect.any(Number),
      expect.any(Object),
    );
  });

  it("injects RECOUP_ACCESS_TOKEN + RECOUP_ORG_ID into the exec env when present in context", async () => {
    const sandbox = makeSandbox({
      exec: vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: "",
        stderr: "",
        truncated: false,
      }),
    });
    vi.mocked(connectVercel).mockResolvedValue(sandbox as never);

    const tool = bashTool();
    await tool.execute!({ command: "curl example.com" }, {
      experimental_context: {
        ...baseContext,
        recoupAccessToken: "rk_abc",
        recoupOrgId: "org-uuid",
      },
    } as never);
    const opts = sandbox.exec.mock.calls[0]?.[3] as { env?: Record<string, string> };
    expect(opts.env).toEqual({
      RECOUP_ACCESS_TOKEN: "rk_abc",
      RECOUP_ORG_ID: "org-uuid",
    });
  });

  it("returns the detached commandId when called with detached:true", async () => {
    const sandbox = makeSandbox({
      execDetached: vi.fn().mockResolvedValue({ commandId: "cmd-123" }),
    });
    vi.mocked(connectVercel).mockResolvedValue(sandbox as never);

    const tool = bashTool();
    const result = (await tool.execute!({ command: "npm run dev", detached: true }, {
      experimental_context: baseContext,
    } as never)) as { success: boolean; stdout: string };
    expect(result.success).toBe(true);
    expect(result.stdout).toMatch(/cmd-123/);
    expect(sandbox.execDetached).toHaveBeenCalledWith("npm run dev", "/sandbox/mono");
  });

  it("returns success:false with a descriptive stderr when the sandbox lacks execDetached", async () => {
    const sandbox = makeSandbox({ execDetached: undefined });
    vi.mocked(connectVercel).mockResolvedValue(sandbox as never);

    const tool = bashTool();
    const result = (await tool.execute!({ command: "npm run dev", detached: true }, {
      experimental_context: baseContext,
    } as never)) as { success: boolean; stderr: string };
    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/detached mode is not supported/i);
  });

  it("does NOT inject RECOUP env vars on detached execs (token is per-prompt only)", async () => {
    const sandbox = makeSandbox({
      execDetached: vi.fn().mockResolvedValue({ commandId: "cmd-1" }),
    });
    vi.mocked(connectVercel).mockResolvedValue(sandbox as never);

    const tool = bashTool();
    await tool.execute!({ command: "npm run dev", detached: true }, {
      experimental_context: {
        ...baseContext,
        recoupAccessToken: "rk_abc",
      },
    } as never);
    // execDetached signature is (command, cwd) — no env arg.
    expect(sandbox.execDetached.mock.calls[0]).toHaveLength(2);
  });
});
