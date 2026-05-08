import { describe, it, expect, vi } from "vitest";
import { resolveSandboxHomeDirectory } from "@/lib/sandbox/resolveSandboxHomeDirectory";

function fakeSandbox(execImpl: () => Promise<{ success: boolean; stdout: string }>) {
  return {
    workingDirectory: "/workspace",
    exec: vi.fn(async () => {
      const result = await execImpl();
      return { ...result, exitCode: result.success ? 0 : 1, stderr: "", truncated: false };
    }),
  };
}

describe("resolveSandboxHomeDirectory", () => {
  it("returns the trimmed $HOME when probe succeeds", async () => {
    const sandbox = fakeSandbox(async () => ({ success: true, stdout: "/home/agent\n" }));
    expect(await resolveSandboxHomeDirectory(sandbox as never)).toBe("/home/agent");
  });

  it("falls back to /root when the probe fails", async () => {
    const sandbox = fakeSandbox(async () => ({ success: false, stdout: "" }));
    expect(await resolveSandboxHomeDirectory(sandbox as never)).toBe("/root");
  });

  it("falls back to /root when the probe returns an empty string", async () => {
    const sandbox = fakeSandbox(async () => ({ success: true, stdout: "   " }));
    expect(await resolveSandboxHomeDirectory(sandbox as never)).toBe("/root");
  });
});
