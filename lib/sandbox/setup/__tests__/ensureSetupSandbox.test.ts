import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { ensureSetupSandbox } from "../ensureSetupSandbox";
import type { SetupDeps } from "../types";

const mockInstallSkill = vi.fn();
const mockRunOpenClawAgent = vi.fn();

vi.mock("../helpers", () => ({
  installSkill: (...args: unknown[]) => mockInstallSkill(...args),
  runOpenClawAgent: (...args: unknown[]) => mockRunOpenClawAgent(...args),
}));

describe("ensureSetupSandbox", () => {
  const mockRunCommand = vi.fn();
  const mockSandbox = {
    sandboxId: "sbx_123",
    runCommand: mockRunCommand,
  } as unknown as Sandbox;
  const deps: SetupDeps = {
    log: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RECOUP_API_KEY", "test-api-key");
    mockRunOpenClawAgent.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("skips when orgs/ directory exists", async () => {
    mockRunCommand.mockResolvedValue({ exitCode: 0 }); // test -d orgs/ succeeds

    await ensureSetupSandbox(mockSandbox, "acc_1", "api-key-123", deps);

    expect(mockInstallSkill).not.toHaveBeenCalled();
  });

  it("installs all three skills when orgs/ missing", async () => {
    mockRunCommand.mockResolvedValue({ exitCode: 1 }); // test -d orgs/ fails

    await ensureSetupSandbox(mockSandbox, "acc_1", "api-key-123", deps);

    expect(mockInstallSkill).toHaveBeenCalledWith(mockSandbox, "recoupable/setup-sandbox", deps);
    expect(mockInstallSkill).toHaveBeenCalledWith(mockSandbox, "recoupable/setup-artist", deps);
    expect(mockInstallSkill).toHaveBeenCalledWith(
      mockSandbox,
      "recoupable/release-management",
      deps,
    );
  });

  it("runs setup-sandbox and setup-artist skills", async () => {
    mockRunCommand.mockResolvedValue({ exitCode: 1 });

    await ensureSetupSandbox(mockSandbox, "acc_1", "api-key-123", deps);

    // setup-sandbox call
    expect(mockRunOpenClawAgent).toHaveBeenCalledWith(
      mockSandbox,
      expect.objectContaining({
        label: expect.stringContaining("setup-sandbox"),
        message: expect.stringContaining("setup-sandbox"),
        env: expect.objectContaining({
          RECOUP_API_KEY: "api-key-123",
          RECOUP_ACCOUNT_ID: "acc_1",
        }),
      }),
      deps,
    );

    // setup-artist call
    expect(mockRunOpenClawAgent).toHaveBeenCalledWith(
      mockSandbox,
      expect.objectContaining({
        label: expect.stringContaining("setup-artist"),
        message: expect.stringContaining("setup-artist"),
      }),
      deps,
    );
  });

  it("throws when setup-sandbox fails", async () => {
    mockRunCommand.mockResolvedValue({ exitCode: 1 });
    mockRunOpenClawAgent.mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "error" });

    await expect(ensureSetupSandbox(mockSandbox, "acc_1", "api-key-123", deps)).rejects.toThrow(
      "Failed to set up sandbox",
    );
  });
});
