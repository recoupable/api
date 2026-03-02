import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { setupFreshSandbox } from "../setupFreshSandbox";

const mockInstallOpenClaw = vi.fn();
const mockSetupOpenClaw = vi.fn();
const mockEnsureGithubRepo = vi.fn();
const mockWriteReadme = vi.fn();
const mockEnsureOrgRepos = vi.fn();
const mockEnsureSetupSandbox = vi.fn();

vi.mock("../installOpenClaw", () => ({
  installOpenClaw: (...args: unknown[]) => mockInstallOpenClaw(...args),
}));

vi.mock("../setupOpenClaw", () => ({
  setupOpenClaw: (...args: unknown[]) => mockSetupOpenClaw(...args),
}));

vi.mock("../ensureGithubRepo", () => ({
  ensureGithubRepo: (...args: unknown[]) => mockEnsureGithubRepo(...args),
}));

vi.mock("../writeReadme", () => ({
  writeReadme: (...args: unknown[]) => mockWriteReadme(...args),
}));

vi.mock("../ensureOrgRepos", () => ({
  ensureOrgRepos: (...args: unknown[]) => mockEnsureOrgRepos(...args),
}));

vi.mock("../ensureSetupSandbox", () => ({
  ensureSetupSandbox: (...args: unknown[]) => mockEnsureSetupSandbox(...args),
}));

describe("setupFreshSandbox", () => {
  const mockSandbox = {
    sandboxId: "sbx_123",
  } as unknown as Sandbox;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureGithubRepo.mockResolvedValue("https://github.com/recoupable/test-repo");
  });

  it("yields progress messages for each setup step", async () => {
    const messages: string[] = [];

    const gen = setupFreshSandbox({
      sandbox: mockSandbox,
      accountId: "acc_1",
      apiKey: "key_123",
    });

    for await (const chunk of gen) {
      messages.push(chunk.data);
    }

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Installing OpenClaw"),
        expect.stringContaining("Configuring OpenClaw"),
        expect.stringContaining("GitHub repository"),
        expect.stringContaining("README"),
        expect.stringContaining("organization repos"),
        expect.stringContaining("skills"),
        expect.stringContaining("complete"),
      ]),
    );
  });

  it("calls all setup functions in order", async () => {
    const callOrder: string[] = [];

    mockInstallOpenClaw.mockImplementation(() => {
      callOrder.push("installOpenClaw");
    });
    mockSetupOpenClaw.mockImplementation(() => {
      callOrder.push("setupOpenClaw");
    });
    mockEnsureGithubRepo.mockImplementation(() => {
      callOrder.push("ensureGithubRepo");
      return "https://github.com/recoupable/test-repo";
    });
    mockWriteReadme.mockImplementation(() => {
      callOrder.push("writeReadme");
    });
    mockEnsureOrgRepos.mockImplementation(() => {
      callOrder.push("ensureOrgRepos");
    });
    mockEnsureSetupSandbox.mockImplementation(() => {
      callOrder.push("ensureSetupSandbox");
    });

    const gen = setupFreshSandbox({
      sandbox: mockSandbox,
      accountId: "acc_1",
      apiKey: "key_123",
    });

    // Consume the generator
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _chunk of gen) {
      // consume
    }

    expect(callOrder).toEqual([
      "installOpenClaw",
      "setupOpenClaw",
      "ensureGithubRepo",
      "writeReadme",
      "ensureOrgRepos",
      "ensureSetupSandbox",
    ]);
  });

  it("passes sandbox and deps to each function", async () => {
    const gen = setupFreshSandbox({
      sandbox: mockSandbox,
      accountId: "acc_1",
      apiKey: "key_123",
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _chunk of gen) {
      // consume
    }

    expect(mockInstallOpenClaw).toHaveBeenCalledWith(
      mockSandbox,
      expect.objectContaining({ log: expect.any(Function) }),
    );
    expect(mockSetupOpenClaw).toHaveBeenCalledWith(
      mockSandbox,
      "acc_1",
      "key_123",
      expect.objectContaining({ log: expect.any(Function) }),
    );
    expect(mockEnsureGithubRepo).toHaveBeenCalledWith(
      mockSandbox,
      "acc_1",
      expect.objectContaining({ log: expect.any(Function) }),
    );
    expect(mockEnsureSetupSandbox).toHaveBeenCalledWith(
      mockSandbox,
      "acc_1",
      "key_123",
      expect.objectContaining({ log: expect.any(Function) }),
    );
  });

  it("returns githubRepo from the generator", async () => {
    mockEnsureGithubRepo.mockResolvedValue("https://github.com/recoupable/my-repo");

    const gen = setupFreshSandbox({
      sandbox: mockSandbox,
      accountId: "acc_1",
      apiKey: "key_123",
    });

    let result;
    while (true) {
      const next = await gen.next();
      if (next.done) {
        result = next.value;
        break;
      }
    }

    expect(result).toBe("https://github.com/recoupable/my-repo");
  });

  it("yields stderr chunks for each step", async () => {
    const chunks: Array<{ data: string; stream: string }> = [];

    const gen = setupFreshSandbox({
      sandbox: mockSandbox,
      accountId: "acc_1",
      apiKey: "key_123",
    });

    for await (const chunk of gen) {
      chunks.push(chunk);
    }

    // All progress messages should be stderr
    expect(chunks.every(c => c.stream === "stderr")).toBe(true);
  });
});
