import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { Sandbox } from "vercel-sandbox-3";
import { startClaudeForBoardTask } from "@/lib/board/startClaudeForBoardTask";

const { runCommand } = vi.hoisted(() => ({ runCommand: vi.fn() }));
vi.mock("vercel-sandbox-3", () => ({
  Sandbox: { create: vi.fn(async () => ({ runCommand })) },
}));

describe("startClaudeForBoardTask", () => {
  const sandboxPolicy = vi.fn(async () => ({
    allow: { "api.vercel.com": [] },
    env: { BOARD_URL: "https://api.vercel.com/board", BOARD_TOKEN: "placeholder" },
  }));
  const as = vi.fn(() => ({ sandboxPolicy }));
  const board = { as } as never;
  const task = { id: "812", channel: "general" };
  const originalKey = process.env.AI_GATEWAY_API_KEY;
  const originalOidc = process.env.VERCEL_OIDC_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_GATEWAY_API_KEY = "gw-key";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = originalKey;
    if (originalOidc === undefined) delete process.env.VERCEL_OIDC_TOKEN;
    else process.env.VERCEL_OIDC_TOKEN = originalOidc;
  });

  it("gives the sandbox the board as claude, narrowed to the task's channel", async () => {
    await startClaudeForBoardTask({ board, task });
    expect(as).toHaveBeenCalledWith({ name: "claude" });
    expect(sandboxPolicy).toHaveBeenCalledWith({
      can: { general: ["read", "post", "react", "label"] },
    });
  });

  it("creates the sandbox with the brokered policy and no real credential in its env", async () => {
    await startClaudeForBoardTask({ board, task });
    const params = vi.mocked(Sandbox.create).mock.calls[0][0] as {
      networkPolicy: { allow: Record<string, unknown> };
      env: Record<string, string>;
    };
    expect(Object.keys(params.networkPolicy.allow)).toContain("ai-gateway.vercel.sh");
    expect(params.env.BOARD_TOKEN).toBe("placeholder");
    expect(params.env.ANTHROPIC_BASE_URL).toBe("https://ai-gateway.vercel.sh");
    expect(Object.values(params.env)).not.toContain("gw-key");
  });

  it("runs the agent detached with the task id and prompt as environment", async () => {
    await startClaudeForBoardTask({ board, task });
    const call = runCommand.mock.calls[0][0] as {
      cmd: string;
      detached: boolean;
      env: Record<string, string>;
    };
    expect(call.cmd).toBe("bash");
    expect(call.detached).toBe(true);
    expect(call.env.TASK_ID).toBe("812");
    expect(call.env.CLAUDE_PROMPT).toContain("vb read 812");
  });

  it("falls back to the deployment's OIDC token for AI Gateway", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    process.env.VERCEL_OIDC_TOKEN = "oidc";
    await startClaudeForBoardTask({ board, task });
    const params = vi.mocked(Sandbox.create).mock.calls[0][0] as {
      networkPolicy: { allow: Record<string, unknown> };
    };
    expect(params.networkPolicy.allow["ai-gateway.vercel.sh"]).toEqual([
      { transform: [{ headers: { Authorization: "Bearer oidc" } }] },
    ]);
  });

  it("throws without starting a sandbox when no gateway credential exists", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
    await expect(startClaudeForBoardTask({ board, task })).rejects.toThrow(/AI Gateway/);
    expect(Sandbox.create).not.toHaveBeenCalled();
  });
});
