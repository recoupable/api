import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSandboxPostHandler } from "../createSandboxPostHandler";
import { validateSandboxBody } from "@/lib/sandbox/validateSandboxBody";
import { createSandbox } from "@/lib/sandbox/createSandbox";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";
import { triggerRunSandboxCommand } from "@/lib/trigger/triggerRunSandboxCommand";

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

  it("returns 200 with sandboxes array on success", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      prompt: "tell me hello",
    });
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
        },
      ],
    });
  });

  it("calls createSandbox without arguments", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      prompt: "tell me hello",
    });
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

    const request = createMockRequest();
    await createSandboxPostHandler(request);

    expect(createSandbox).toHaveBeenCalledWith();
  });

  it("calls insertAccountSandbox with correct account_id and sandbox_id", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      prompt: "tell me hello",
    });
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

    const request = createMockRequest();
    await createSandboxPostHandler(request);

    expect(insertAccountSandbox).toHaveBeenCalledWith({
      account_id: "acc_123",
      sandbox_id: "sbx_456",
    });
  });

  it("calls triggerRunSandboxCommand with prompt and sandboxId", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      prompt: "tell me hello",
    });
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

    const request = createMockRequest();
    await createSandboxPostHandler(request);

    expect(triggerRunSandboxCommand).toHaveBeenCalledWith({
      prompt: "tell me hello",
      sandboxId: "sbx_789",
    });
  });

  it("returns 400 with error status when createSandbox throws", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      prompt: "tell me hello",
    });
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
      prompt: "tell me hello",
    });
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

  it("returns 400 with error status when triggerRunSandboxCommand throws", async () => {
    vi.mocked(validateSandboxBody).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
      prompt: "tell me hello",
    });
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

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({
      status: "error",
      error: "Task trigger failed",
    });
  });
});
