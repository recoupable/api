import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateCommitMessage } from "@/lib/chat/auto-commit/generateCommitMessage";
import generateText from "@/lib/ai/generateText";
import type { ExecResult, Sandbox } from "@/lib/sandbox/abstraction";

vi.mock("@/lib/ai/generateText", () => ({ default: vi.fn() }));

const ok = (stdout = "", stderr = ""): ExecResult => ({
  success: true,
  exitCode: 0,
  stdout,
  stderr,
  truncated: false,
});

function makeSandbox(handlers: Record<string, ExecResult> = {}) {
  const exec = vi.fn((cmd: string) => {
    for (const [pattern, result] of Object.entries(handlers)) {
      if (cmd.includes(pattern)) return Promise.resolve(result);
    }
    return Promise.resolve(ok());
  });
  return { exec } as unknown as Sandbox;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateCommitMessage", () => {
  it("returns the LLM-generated message when the gateway succeeds", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: "feat: add hello world endpoint",
    } as never);
    const sandbox = makeSandbox({
      "git diff --cached": ok("some diff content"),
    });
    const msg = await generateCommitMessage(sandbox, "/sandbox", "test session");
    expect(msg).toBe("feat: add hello world endpoint");
  });

  it("falls back to default message when staged diff is empty", async () => {
    const sandbox = makeSandbox({ "git diff --cached": ok("") });
    const msg = await generateCommitMessage(sandbox, "/sandbox", "session");
    expect(msg).toBe("chore: update repository changes");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("falls back to default message when generateText rejects", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("gateway down"));
    const sandbox = makeSandbox({ "git diff --cached": ok("diff") });
    const msg = await generateCommitMessage(sandbox, "/sandbox", "session");
    expect(msg).toBe("chore: update repository changes");
  });

  it("truncates the LLM-generated message to 72 chars", async () => {
    const longMessage = "feat: " + "x".repeat(200);
    vi.mocked(generateText).mockResolvedValue({ text: longMessage } as never);
    const sandbox = makeSandbox({ "git diff --cached": ok("diff") });
    const msg = await generateCommitMessage(sandbox, "/sandbox", "session");
    expect(msg.length).toBeLessThanOrEqual(72);
  });

  it("takes only the first line of the LLM output (strips trailing prose)", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: "feat: clean header\n\nMore details about the change.",
    } as never);
    const sandbox = makeSandbox({ "git diff --cached": ok("diff") });
    const msg = await generateCommitMessage(sandbox, "/sandbox", "session");
    expect(msg).toBe("feat: clean header");
  });

  it("falls back when LLM returns an empty string", async () => {
    vi.mocked(generateText).mockResolvedValue({ text: "" } as never);
    const sandbox = makeSandbox({ "git diff --cached": ok("diff") });
    const msg = await generateCommitMessage(sandbox, "/sandbox", "session");
    expect(msg).toBe("chore: update repository changes");
  });
});
