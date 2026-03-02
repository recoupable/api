import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { writeReadme } from "../writeReadme";
import type { SetupDeps } from "../types";

describe("writeReadme", () => {
  const mockRunCommand = vi.fn();
  const mockWriteFiles = vi.fn();
  const mockSandbox = {
    sandboxId: "sbx_123",
    runCommand: mockRunCommand,
    writeFiles: mockWriteFiles,
  } as unknown as Sandbox;
  const deps: SetupDeps = {
    log: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when README already has sandbox details", async () => {
    mockRunCommand.mockResolvedValue({ exitCode: 0 }); // grep finds "Recoup Sandbox"

    await writeReadme(mockSandbox, "sbx_123", "acc_1", undefined, deps);

    expect(mockWriteFiles).not.toHaveBeenCalled();
  });

  it("writes README with sandbox details", async () => {
    mockRunCommand.mockResolvedValue({ exitCode: 1 }); // grep fails - no existing content

    await writeReadme(mockSandbox, "sbx_123", "acc_1", "https://github.com/recoupable/repo", deps);

    expect(mockWriteFiles).toHaveBeenCalledWith([
      expect.objectContaining({
        path: "/vercel/sandbox/README.md",
      }),
    ]);

    const content = mockWriteFiles.mock.calls[0][0][0].content.toString();
    expect(content).toContain("Recoup Sandbox");
    expect(content).toContain("sbx_123");
    expect(content).toContain("acc_1");
    expect(content).toContain("https://github.com/recoupable/repo");
  });

  it("shows 'Not configured' when no github repo", async () => {
    mockRunCommand.mockResolvedValue({ exitCode: 1 });

    await writeReadme(mockSandbox, "sbx_123", "acc_1", undefined, deps);

    const content = mockWriteFiles.mock.calls[0][0][0].content.toString();
    expect(content).toContain("Not configured");
  });
});
