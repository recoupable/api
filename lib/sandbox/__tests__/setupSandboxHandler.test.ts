import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { setupSandboxHandler } from "@/lib/sandbox/setupSandboxHandler";

import { validateSetupSandboxBody } from "@/lib/sandbox/validateSetupSandboxBody";
import { triggerSetupSandbox } from "@/lib/trigger/triggerSetupSandbox";
import { isSandboxProvisioned } from "@/lib/sandbox/isSandboxProvisioned";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/sandbox/validateSetupSandboxBody", () => ({
  validateSetupSandboxBody: vi.fn(),
}));

vi.mock("@/lib/trigger/triggerSetupSandbox", () => ({
  triggerSetupSandbox: vi.fn(),
}));

vi.mock("@/lib/sandbox/isSandboxProvisioned", () => ({
  isSandboxProvisioned: vi.fn(),
}));

describe("setupSandboxHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSandboxProvisioned).mockResolvedValue(false);
  });

  it("returns validation error when validation fails", async () => {
    const errorResponse = NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401 },
    );
    vi.mocked(validateSetupSandboxBody).mockResolvedValue(errorResponse);

    const request = new NextRequest("http://localhost/api/sandboxes/setup", {
      method: "POST",
    });

    const result = await setupSandboxHandler(request);

    expect(result).toBe(errorResponse);
  });

  it("returns early when sandbox is already provisioned", async () => {
    vi.mocked(validateSetupSandboxBody).mockResolvedValue({
      accountId: "test-account-id",
    });
    vi.mocked(isSandboxProvisioned).mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/sandboxes/setup", {
      method: "POST",
    });

    const result = await setupSandboxHandler(request);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body).toEqual({ status: "success", message: "already provisioned" });
    expect(triggerSetupSandbox).not.toHaveBeenCalled();
  });

  it("returns success with runId when trigger succeeds", async () => {
    vi.mocked(validateSetupSandboxBody).mockResolvedValue({
      accountId: "test-account-id",
    });
    vi.mocked(triggerSetupSandbox).mockResolvedValue({
      id: "run_abc123",
    } as never);

    const request = new NextRequest("http://localhost/api/sandboxes/setup", {
      method: "POST",
    });

    const result = await setupSandboxHandler(request);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body).toEqual({ status: "success", runId: "run_abc123" });
  });

  it("returns error when trigger fails", async () => {
    vi.mocked(validateSetupSandboxBody).mockResolvedValue({
      accountId: "test-account-id",
    });
    vi.mocked(triggerSetupSandbox).mockRejectedValue(new Error("Trigger.dev connection failed"));

    const request = new NextRequest("http://localhost/api/sandboxes/setup", {
      method: "POST",
    });

    const result = await setupSandboxHandler(request);
    const body = await result.json();

    expect(result.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Trigger.dev connection failed",
    });
  });
});
