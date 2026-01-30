import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSandboxPostHandler } from "../createSandboxPostHandler";
import { validateSandboxBody } from "@/lib/sandbox/validateSandboxBody";
import { createSandbox } from "@/lib/sandbox/createSandbox";

vi.mock("@/lib/sandbox/validateSandboxBody", () => ({
  validateSandboxBody: vi.fn(),
}));

vi.mock("@/lib/sandbox/createSandbox", () => ({
  createSandbox: vi.fn(),
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
});
