import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { ensureGithubRepo } from "../ensureGithubRepo";
import type { SetupDeps } from "../types";

const mockSelectAccountSnapshots = vi.fn();
const mockSelectAccounts = vi.fn();
const mockCreateGithubRepo = vi.fn();
const mockUpsertAccountSnapshot = vi.fn();

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: (...args: unknown[]) => mockSelectAccountSnapshots(...args),
}));

vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: (...args: unknown[]) => mockSelectAccounts(...args),
}));

vi.mock("@/lib/github/createGithubRepo", () => ({
  createGithubRepo: (...args: unknown[]) => mockCreateGithubRepo(...args),
}));

vi.mock("@/lib/supabase/account_snapshots/upsertAccountSnapshot", () => ({
  upsertAccountSnapshot: (...args: unknown[]) => mockUpsertAccountSnapshot(...args),
}));

describe("ensureGithubRepo", () => {
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
    vi.stubEnv("GITHUB_TOKEN", "test-token");
  });

  it("returns undefined when GITHUB_TOKEN is missing", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    delete process.env.GITHUB_TOKEN;

    const result = await ensureGithubRepo(mockSandbox, "acc_1", deps);

    expect(result).toBeUndefined();
  });

  it("uses existing github_repo from snapshot", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([
      {
        account_id: "acc_1",
        github_repo: "https://github.com/recoupable/my-repo",
        snapshot_id: "snap_1",
      },
    ]);

    // .git exists
    mockRunCommand.mockResolvedValue({ exitCode: 0 });

    const result = await ensureGithubRepo(mockSandbox, "acc_1", deps);

    expect(result).toBe("https://github.com/recoupable/my-repo");
    expect(mockCreateGithubRepo).not.toHaveBeenCalled();
  });

  it("creates repo when none exists", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([
      { account_id: "acc_1", github_repo: null, snapshot_id: "snap_1" },
    ]);
    mockSelectAccounts.mockResolvedValue([{ id: "acc_1", name: "Test Account" }]);
    mockCreateGithubRepo.mockResolvedValue("https://github.com/recoupable/test-account-acc_1");
    mockUpsertAccountSnapshot.mockResolvedValue({ data: {}, error: null });

    // .git check returns exists (after clone succeeds)
    mockRunCommand.mockResolvedValue({ exitCode: 0 });

    const result = await ensureGithubRepo(mockSandbox, "acc_1", deps);

    expect(result).toBe("https://github.com/recoupable/test-account-acc_1");
    expect(mockCreateGithubRepo).toHaveBeenCalledWith("Test Account", "acc_1");
    expect(mockUpsertAccountSnapshot).toHaveBeenCalled();
  });

  it("clones repo when .git not present", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([
      {
        account_id: "acc_1",
        github_repo: "https://github.com/recoupable/my-repo",
        snapshot_id: "snap_1",
      },
    ]);

    // First call: .git check (not present)
    // Subsequent calls: git init, remote add, fetch, rev-parse, checkout, config, submodule
    mockRunCommand
      .mockResolvedValueOnce({ exitCode: 1 }) // test -d .git fails
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue(""),
      }) // git init
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue(""),
      }) // git remote add
      .mockResolvedValueOnce({ exitCode: 0 }) // git fetch
      .mockResolvedValueOnce({ exitCode: 0 }) // rev-parse origin/main
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue(""),
      }) // checkout
      .mockResolvedValueOnce({ exitCode: 0 }) // git config url
      .mockResolvedValueOnce({ exitCode: 0 }); // submodule update

    const result = await ensureGithubRepo(mockSandbox, "acc_1", deps);

    expect(result).toBe("https://github.com/recoupable/my-repo");
    // Verify git init was called
    expect(mockRunCommand).toHaveBeenCalledWith({
      cmd: "git",
      args: ["init"],
    });
  });

  it("returns undefined when account not found for repo creation", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([]);
    mockSelectAccounts.mockResolvedValue([]);

    const result = await ensureGithubRepo(mockSandbox, "acc_1", deps);

    expect(result).toBeUndefined();
  });
});
