import { describe, it, expect, vi, beforeEach } from "vitest";

import { processCreateSandbox } from "../processCreateSandbox";
import { createSandbox } from "@/lib/sandbox/createSandbox";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";
import { triggerPromptSandbox } from "@/lib/trigger/triggerPromptSandbox";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";

vi.mock("@/lib/sandbox/createSandbox", () => ({
  createSandbox: vi.fn(),
}));

vi.mock("@/lib/supabase/account_sandboxes/insertAccountSandbox", () => ({
  insertAccountSandbox: vi.fn(),
}));

vi.mock("@/lib/trigger/triggerPromptSandbox", () => ({
  triggerPromptSandbox: vi.fn(),
}));

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(),
}));

describe("processCreateSandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates sandbox without prompt and returns result without runId", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandbox: {} as never,
      response: {
        sandboxId: "sbx_123",
        sandboxStatus: "running",
        timeout: 600000,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });
    vi.mocked(insertAccountSandbox).mockResolvedValue({
      data: {
        id: "record_123",
        account_id: "acc_123",
        sandbox_id: "sbx_123",
        created_at: "2024-01-01T00:00:00.000Z",
      },
      error: null,
    });

    const result = await processCreateSandbox({ accountId: "acc_123" });

    expect(result).toEqual({
      sandboxId: "sbx_123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    expect(triggerPromptSandbox).not.toHaveBeenCalled();
  });

  it("creates sandbox with prompt and returns result with runId", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandbox: {} as never,
      response: {
        sandboxId: "sbx_123",
        sandboxStatus: "running",
        timeout: 600000,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });
    vi.mocked(insertAccountSandbox).mockResolvedValue({
      data: {
        id: "record_123",
        account_id: "acc_123",
        sandbox_id: "sbx_123",
        created_at: "2024-01-01T00:00:00.000Z",
      },
      error: null,
    });
    vi.mocked(triggerPromptSandbox).mockResolvedValue({
      id: "run_prompt123",
    });

    const result = await processCreateSandbox({
      accountId: "acc_123",
      prompt: "create a hello world index.html",
    });

    expect(result).toEqual({
      sandboxId: "sbx_123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
      runId: "run_prompt123",
    });
    expect(triggerPromptSandbox).toHaveBeenCalledWith({
      prompt: "create a hello world index.html",
      sandboxId: "sbx_123",
      accountId: "acc_123",
    });
  });

  it("uses snapshot when account has one", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      {
        id: "snap_record_123",
        account_id: "acc_123",
        snapshot_id: "snap_xyz",
        created_at: "2024-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandbox: {} as never,
      response: {
        sandboxId: "sbx_456",
        sandboxStatus: "running",
        timeout: 600000,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });
    vi.mocked(insertAccountSandbox).mockResolvedValue({
      data: {
        id: "record_123",
        account_id: "acc_123",
        sandbox_id: "sbx_456",
        created_at: "2024-01-01T00:00:00.000Z",
      },
      error: null,
    });

    await processCreateSandbox({ accountId: "acc_123" });

    expect(createSandbox).toHaveBeenCalledWith({
      source: { type: "snapshot", snapshotId: "snap_xyz" },
    });
  });

  it("calls createSandbox with empty params when no snapshot", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandbox: {} as never,
      response: {
        sandboxId: "sbx_456",
        sandboxStatus: "running",
        timeout: 600000,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });
    vi.mocked(insertAccountSandbox).mockResolvedValue({
      data: {
        id: "record_123",
        account_id: "acc_123",
        sandbox_id: "sbx_456",
        created_at: "2024-01-01T00:00:00.000Z",
      },
      error: null,
    });

    await processCreateSandbox({ accountId: "acc_123" });

    expect(createSandbox).toHaveBeenCalledWith({});
  });

  it("inserts account_sandbox record", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandbox: {} as never,
      response: {
        sandboxId: "sbx_789",
        sandboxStatus: "running",
        timeout: 600000,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });
    vi.mocked(insertAccountSandbox).mockResolvedValue({
      data: {
        id: "record_123",
        account_id: "acc_123",
        sandbox_id: "sbx_789",
        created_at: "2024-01-01T00:00:00.000Z",
      },
      error: null,
    });

    await processCreateSandbox({ accountId: "acc_123" });

    expect(insertAccountSandbox).toHaveBeenCalledWith({
      account_id: "acc_123",
      sandbox_id: "sbx_789",
    });
  });

  it("throws when createSandbox fails", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockRejectedValue(new Error("Sandbox creation failed"));

    await expect(processCreateSandbox({ accountId: "acc_123" })).rejects.toThrow(
      "Sandbox creation failed",
    );
  });

  it("returns result without runId when triggerPromptSandbox fails", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandbox: {} as never,
      response: {
        sandboxId: "sbx_123",
        sandboxStatus: "running",
        timeout: 600000,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });
    vi.mocked(insertAccountSandbox).mockResolvedValue({
      data: {
        id: "record_123",
        account_id: "acc_123",
        sandbox_id: "sbx_123",
        created_at: "2024-01-01T00:00:00.000Z",
      },
      error: null,
    });
    vi.mocked(triggerPromptSandbox).mockRejectedValue(new Error("Task trigger failed"));

    const result = await processCreateSandbox({
      accountId: "acc_123",
      prompt: "say hello",
    });

    expect(result).toEqual({
      sandboxId: "sbx_123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
  });
});
