import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSandboxPostHandler } from "../createSandboxPostHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { createSandbox } from "@/lib/sandbox/createSandbox";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/sandbox/createSandbox", () => ({
  createSandbox: vi.fn(),
}));

/**
 * Creates a mock NextRequest for testing.
 *
 * @param body - The request body to return from json()
 * @returns A mock NextRequest object
 */
function createMockRequest(body: unknown): NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ "x-api-key": "test-key" }),
  } as unknown as NextRequest;
}

describe("createSandboxPostHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = createMockRequest({ script: "test" });
    const response = await createSandboxPostHandler(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when body is invalid JSON", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
    });

    const request = {
      json: () => Promise.reject(new Error("Invalid JSON")),
      headers: new Headers({ "x-api-key": "test-key" }),
    } as unknown as NextRequest;

    const response = await createSandboxPostHandler(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid JSON body");
  });

  it("returns 400 when prompt is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
    });

    const request = createMockRequest({});
    const response = await createSandboxPostHandler(request);

    expect(response.status).toBe(400);
  });

  it("returns 200 with sandbox result on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(createSandbox).mockResolvedValue({
      sandboxId: "sbx_123",
      status: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const request = createMockRequest({ prompt: "tell me hello" });
    const response = await createSandboxPostHandler(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.sandboxId).toBe("sbx_123");
    expect(json.status).toBe("running");
    expect(json.timeout).toBe(600000);
  });

  it("returns 400 when createSandbox throws", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(createSandbox).mockRejectedValue(new Error("Sandbox creation failed"));

    const request = createMockRequest({ prompt: "tell me hello" });
    const response = await createSandboxPostHandler(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Sandbox creation failed");
  });
});
