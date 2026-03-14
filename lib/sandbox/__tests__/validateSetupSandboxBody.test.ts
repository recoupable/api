import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateSetupSandboxBody } from "@/lib/sandbox/validateSetupSandboxBody";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

describe("validateSetupSandboxBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    const authError = NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401 },
    );
    vi.mocked(safeParseJson).mockResolvedValue({});
    vi.mocked(validateAuthContext).mockResolvedValue(authError);

    const request = new NextRequest("http://localhost/api/sandboxes/setup", {
      method: "POST",
    });

    const result = await validateSetupSandboxBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 400 when account_id is not a valid UUID", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({
      account_id: "not-a-uuid",
    });

    const request = new NextRequest("http://localhost/api/sandboxes/setup", {
      method: "POST",
    });

    const result = await validateSetupSandboxBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns validated accountId on success with no body", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({});
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "resolved-account-id",
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/sandboxes/setup", {
      method: "POST",
    });

    const result = await validateSetupSandboxBody(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ accountId: "resolved-account-id" });
  });

  it("passes account_id override to validateAuthContext for org keys", async () => {
    const targetAccountId = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(safeParseJson).mockResolvedValue({
      account_id: targetAccountId,
    });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: targetAccountId,
      orgId: "org-123",
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/sandboxes/setup", {
      method: "POST",
    });

    const result = await validateSetupSandboxBody(request);

    expect(validateAuthContext).toHaveBeenCalledWith(request, {
      accountId: targetAccountId,
    });
    expect(result).toEqual({ accountId: targetAccountId });
  });

  it("calls validateAuthContext with no accountId when body is empty", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({});
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "default-account-id",
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/sandboxes/setup", {
      method: "POST",
    });

    await validateSetupSandboxBody(request);

    expect(validateAuthContext).toHaveBeenCalledWith(request, {
      accountId: undefined,
    });
  });
});
