import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { createSandboxFromSnapshot } from "../createSandboxFromSnapshot";

const mockGetValidSnapshotId = vi.fn();
const mockGetAccountGithubRepo = vi.fn();
const mockInsertAccountSandbox = vi.fn();
const mockCreateSandboxWithFallback = vi.fn();
const mockCloneGithubRepoInSandbox = vi.fn();

vi.mock("@/lib/sandbox/createSandboxWithFallback", () => ({
  createSandboxWithFallback: (...args: unknown[]) => mockCreateSandboxWithFallback(...args),
}));

vi.mock("@/lib/sandbox/cloneGithubRepoInSandbox", () => ({
  cloneGithubRepoInSandbox: (...args: unknown[]) => mockCloneGithubRepoInSandbox(...args),
}));

vi.mock("@/lib/sandbox/getAccountGithubRepo", () => ({
  getAccountGithubRepo: (...args: unknown[]) => mockGetAccountGithubRepo(...args),
}));

vi.mock("@/lib/sandbox/getValidSnapshotId", () => ({
  getValidSnapshotId: (...args: unknown[]) => mockGetValidSnapshotId(...args),
}));

vi.mock("@/lib/supabase/account_sandboxes/insertAccountSandbox", () => ({
  insertAccountSandbox: (...args: unknown[]) => mockInsertAccountSandbox(...args),
}));

describe("createSandboxFromSnapshot", () => {
  const mockSandbox = {
    sandboxId: "sbx_new",
    status: "running",
    runCommand: vi.fn(),
  } as unknown as Sandbox;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccountGithubRepo.mockResolvedValue(null);
    mockCreateSandboxWithFallback.mockResolvedValue({
      sandbox: mockSandbox,
      response: {
        sandboxId: "sbx_new",
        sandboxStatus: "running",
        timeout: 1800000,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      fromSnapshot: false,
    });
    mockInsertAccountSandbox.mockResolvedValue({
      data: { account_id: "acc_1", sandbox_id: "sbx_new" },
      error: null,
    });
  });

  it("passes snapshotId to createSandboxWithFallback", async () => {
    mockGetValidSnapshotId.mockResolvedValue("snap_abc");

    await createSandboxFromSnapshot("acc_1");

    expect(mockCreateSandboxWithFallback).toHaveBeenCalledWith("snap_abc");
  });

  it("passes undefined when no snapshot exists", async () => {
    mockGetValidSnapshotId.mockResolvedValue(undefined);

    await createSandboxFromSnapshot("acc_1");

    expect(mockCreateSandboxWithFallback).toHaveBeenCalledWith(undefined);
  });

  it("inserts account_sandbox record", async () => {
    mockGetValidSnapshotId.mockResolvedValue(undefined);

    await createSandboxFromSnapshot("acc_1");

    expect(mockInsertAccountSandbox).toHaveBeenCalledWith({
      account_id: "acc_1",
      sandbox_id: "sbx_new",
    });
  });

  it("returns { sandbox, fromSnapshot: true } when snapshot used", async () => {
    mockGetValidSnapshotId.mockResolvedValue("snap_abc");
    mockCreateSandboxWithFallback.mockResolvedValue({
      sandbox: mockSandbox,
      response: {
        sandboxId: "sbx_new",
        sandboxStatus: "running",
        timeout: 1800000,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      fromSnapshot: true,
    });

    const result = await createSandboxFromSnapshot("acc_1");

    expect(result).toEqual({ sandbox: mockSandbox, fromSnapshot: true });
  });

  it("returns { sandbox, fromSnapshot: false } when no snapshot", async () => {
    mockGetValidSnapshotId.mockResolvedValue(undefined);

    const result = await createSandboxFromSnapshot("acc_1");

    expect(result).toEqual({ sandbox: mockSandbox, fromSnapshot: false });
  });

  it("returns { sandbox, fromSnapshot: false } for expired snapshot", async () => {
    mockGetValidSnapshotId.mockResolvedValue(undefined);

    const result = await createSandboxFromSnapshot("acc_1");

    expect(mockCreateSandboxWithFallback).toHaveBeenCalledWith(undefined);
    expect(result).toEqual({ sandbox: mockSandbox, fromSnapshot: false });
  });

  it("returns { sandbox, fromSnapshot: false } when snapshot creation fails", async () => {
    mockGetValidSnapshotId.mockResolvedValue("snap_bad");
    mockCreateSandboxWithFallback.mockResolvedValue({
      sandbox: mockSandbox,
      response: {
        sandboxId: "sbx_new",
        sandboxStatus: "running",
        timeout: 1800000,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      fromSnapshot: false,
    });

    const result = await createSandboxFromSnapshot("acc_1");

    expect(result).toEqual({ sandbox: mockSandbox, fromSnapshot: false });
  });

  it("clones github_repo into sandbox when account has one", async () => {
    mockGetValidSnapshotId.mockResolvedValue("snap_abc");
    mockGetAccountGithubRepo.mockResolvedValue("https://github.com/artist/website");

    await createSandboxFromSnapshot("acc_1");

    expect(mockCloneGithubRepoInSandbox).toHaveBeenCalledWith(
      mockSandbox,
      "https://github.com/artist/website",
    );
  });

  it("does not clone when account has no github_repo", async () => {
    mockGetValidSnapshotId.mockResolvedValue("snap_abc");
    mockGetAccountGithubRepo.mockResolvedValue(null);

    await createSandboxFromSnapshot("acc_1");

    expect(mockCloneGithubRepoInSandbox).toHaveBeenCalledWith(mockSandbox, null);
  });

  it("still returns result when clone fails (non-fatal)", async () => {
    mockGetValidSnapshotId.mockResolvedValue("snap_abc");
    mockGetAccountGithubRepo.mockResolvedValue("https://github.com/artist/website");
    mockCreateSandboxWithFallback.mockResolvedValue({
      sandbox: mockSandbox,
      response: {
        sandboxId: "sbx_new",
        sandboxStatus: "running",
        timeout: 1800000,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      fromSnapshot: true,
    });
    mockCloneGithubRepoInSandbox.mockRejectedValue(new Error("Failed to clone GitHub repo"));

    const result = await createSandboxFromSnapshot("acc_1");

    expect(result).toEqual({ sandbox: mockSandbox, fromSnapshot: true });
  });
});
