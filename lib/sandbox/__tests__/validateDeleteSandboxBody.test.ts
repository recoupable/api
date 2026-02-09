import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

import { validateDeleteSandboxBody } from "../validateDeleteSandboxBody";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

/**
 *
 */
function createMockRequest(): Request {
  return new Request("https://example.com/api/sandboxes", {
    method: "DELETE",
  });
}

describe("validateDeleteSandboxBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({});
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = createMockRequest();
    const result = await validateDeleteSandboxBody(request as never);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 400 when account_id is not a valid UUID", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({
      account_id: "not-a-uuid",
    });

    const request = createMockRequest();
    const result = await validateDeleteSandboxBody(request as never);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns validated accountId on success", async () => {
    const mockAccountId = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(safeParseJson).mockResolvedValue({});
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null,
      authToken: "test-token",
    });

    const request = createMockRequest();
    const result = await validateDeleteSandboxBody(request as never);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ accountId: mockAccountId });
  });

  it("passes account_id override to validateAuthContext", async () => {
    const targetAccountId = "660e8400-e29b-41d4-a716-446655440000";
    vi.mocked(safeParseJson).mockResolvedValue({
      account_id: targetAccountId,
    });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: targetAccountId,
      orgId: "org-123",
      authToken: "test-token",
    });

    const request = createMockRequest();
    const result = await validateDeleteSandboxBody(request as never);

    expect(validateAuthContext).toHaveBeenCalledWith(request, { accountId: targetAccountId });
    expect(result).toEqual({ accountId: targetAccountId });
  });

  it("calls validateAuthContext with no accountId when body is empty", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({});
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      orgId: null,
      authToken: "test-token",
    });

    const request = createMockRequest();
    await validateDeleteSandboxBody(request as never);

    expect(validateAuthContext).toHaveBeenCalledWith(request, { accountId: undefined });
  });
});
