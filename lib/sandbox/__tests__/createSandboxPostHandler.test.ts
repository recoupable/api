import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSandboxPostHandler } from "../createSandboxPostHandler";
import { validateSandboxBody } from "@/lib/sandbox/validateSandboxBody";
import { createSandbox } from "@/lib/sandbox/createSandbox";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";
import { triggerRunSandboxCommand } from "@/lib/trigger/triggerRunSandboxCommand";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";

vi.mock("@/lib/sandbox/validateSandboxBody", () => ({
  validateSandboxBody: vi.fn(),
}));

vi.mock("@/lib/sandbox/createSandbox", () => ({
  createSandbox: vi.fn(),
}));

vi.mock("@/lib/supabase/account_sandboxes/insertAccountSandbox", () => ({
  insertAccountSandbox: vi.fn(),
}));

vi.mock("@/lib/trigger/triggerRunSandboxCommand", () => ({
  triggerRunSandboxCommand: vi.fn(),
}));

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(),
}));

/**
 * Creates a mock NextRequest for testing.
 *
 * @returns A mock NextRequest object
 */
function createMockRequest(): NextRequest {
  return {
    headers: new Headers({ "x-api-key": "test-key" }),
  } as unknown as NextRequest;
}

describe("createSandboxPostHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error response when validation fails", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = createMockRequest();
    const response = await createSandboxPostHandler(request);

    expect(response.status).toBe(401);
  });

  it("returns 200 with sandboxes array including runId on success", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      command: "ls",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandboxId: "sbx_123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
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
    vi.mocked(triggerRunSandboxCommand).mockResolvedValue({
      id: "run_abc123",
    });

    const request = createMockRequest();
    const response = await createSandboxPostHandler(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      status: "success",
      sandboxes: [
        {
          sandboxId: "sbx_123",
          sandboxStatus: "running",
          timeout: 600000,
          createdAt: "2024-01-01T00:00:00.000Z",
          runId: "run_abc123",
        },
      ],
    });
  });

  it("calls createSandbox with snapshotId when account has snapshot", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      command: "ls",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      {
        id: "snap_record_123",
        account_id: "acc_123",
        snapshot_id: "snap_xyz",
        created_at: "2024-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandboxId: "sbx_456",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
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
    vi.mocked(triggerRunSandboxCommand).mockResolvedValue({
      id: "run_def456",
    });

    const request = createMockRequest();
    await createSandboxPostHandler(request);

    expect(createSandbox).toHaveBeenCalledWith({
      source: { type: "snapshot", snapshotId: "snap_xyz" },
    });
  });

  it("calls createSandbox with empty params when account has no snapshot", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      command: "ls",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandboxId: "sbx_456",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
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
    vi.mocked(triggerRunSandboxCommand).mockResolvedValue({
      id: "run_def456",
    });

    const request = createMockRequest();
    await createSandboxPostHandler(request);

    expect(createSandbox).toHaveBeenCalledWith({});
  });

  it("calls insertAccountSandbox with correct account_id and sandbox_id", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      command: "ls",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandboxId: "sbx_456",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
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
    vi.mocked(triggerRunSandboxCommand).mockResolvedValue({
      id: "run_def456",
    });

    const request = createMockRequest();
    await createSandboxPostHandler(request);

    expect(insertAccountSandbox).toHaveBeenCalledWith({
      account_id: "acc_123",
      sandbox_id: "sbx_456",
    });
  });

  it("calls triggerRunSandboxCommand with command, args, cwd, sandboxId, and accountId", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      command: "ls",
      args: ["-la"],
      cwd: "/home",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandboxId: "sbx_789",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
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
    vi.mocked(triggerRunSandboxCommand).mockResolvedValue({
      id: "run_ghi789",
    });

    const request = createMockRequest();
    await createSandboxPostHandler(request);

    expect(triggerRunSandboxCommand).toHaveBeenCalledWith({
      command: "ls",
      args: ["-la"],
      cwd: "/home",
      sandboxId: "sbx_789",
      accountId: "acc_123",
    });
  });

  it("returns 400 with error status when createSandbox throws", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      command: "ls",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockRejectedValue(new Error("Sandbox creation failed"));

    const request = createMockRequest();
    const response = await createSandboxPostHandler(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({
      status: "error",
      error: "Sandbox creation failed",
    });
  });

  it("returns 400 with error status when insertAccountSandbox throws", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      command: "ls",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandboxId: "sbx_123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    vi.mocked(insertAccountSandbox).mockRejectedValue(new Error("Database insert failed"));

    const request = createMockRequest();
    const response = await createSandboxPostHandler(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({
      status: "error",
      error: "Database insert failed",
    });
  });

  it("returns 200 without runId and skips trigger when command is not provided", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      // command is not provided (optional)
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandboxId: "sbx_123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
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

    const request = createMockRequest();
    const response = await createSandboxPostHandler(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      status: "success",
      sandboxes: [
        {
          sandboxId: "sbx_123",
          sandboxStatus: "running",
          timeout: 600000,
          createdAt: "2024-01-01T00:00:00.000Z",
          // Note: runId is not included when command is not provided
        },
      ],
    });
    // Verify triggerRunSandboxCommand was NOT called
    expect(triggerRunSandboxCommand).not.toHaveBeenCalled();
  });

  it("returns 200 without runId when triggerRunSandboxCommand throws", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      command: "ls",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    vi.mocked(createSandbox).mockResolvedValue({
      sandboxId: "sbx_123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
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
    vi.mocked(triggerRunSandboxCommand).mockRejectedValue(new Error("Task trigger failed"));

    const request = createMockRequest();
    const response = await createSandboxPostHandler(request);

    // Sandbox was created successfully, so return 200 even if trigger fails
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      status: "success",
      sandboxes: [
        {
          sandboxId: "sbx_123",
          sandboxStatus: "running",
          timeout: 600000,
          createdAt: "2024-01-01T00:00:00.000Z",
          // Note: runId is not included when trigger fails
        },
      ],
    });
  });
});
