import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetConnectorActionsRequest } from "../validateGetConnectorActionsRequest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountAccess } from "@/lib/auth/checkAccountAccess";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/auth/checkAccountAccess", () => ({
  checkAccountAccess: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

describe("validateGetConnectorActionsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/connectors/actions");
    const result = await validateGetConnectorActionsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("should return authenticated accountId when no account_id query param", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/connectors/actions");
    const result = await validateGetConnectorActionsRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ accountId: "account-123" });
  });

  it("should return target accountId when account_id query param + access granted", async () => {
    const target = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(checkAccountAccess).mockResolvedValue({ hasAccess: true, entityType: "artist" });

    const request = new NextRequest(`http://localhost/api/connectors/actions?account_id=${target}`);
    const result = await validateGetConnectorActionsRequest(request);

    expect(checkAccountAccess).toHaveBeenCalledWith("account-123", target);
    expect(result).toEqual({ accountId: target });
  });

  it("should return 403 when account_id provided and access denied", async () => {
    const target = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(checkAccountAccess).mockResolvedValue({ hasAccess: false });

    const request = new NextRequest(`http://localhost/api/connectors/actions?account_id=${target}`);
    const result = await validateGetConnectorActionsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("should return 400 for invalid account_id UUID", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest(
      "http://localhost/api/connectors/actions?account_id=not-a-uuid",
    );
    const result = await validateGetConnectorActionsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
