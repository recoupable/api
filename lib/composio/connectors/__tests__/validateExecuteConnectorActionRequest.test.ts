import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateExecuteConnectorActionRequest } from "../validateExecuteConnectorActionRequest";

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

const validBody = {
  actionSlug: "GMAIL_FETCH_EMAILS",
  parameters: { max_results: 10 },
};

const buildRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/connectors/actions", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("validateExecuteConnectorActionRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateExecuteConnectorActionRequest(buildRequest(validBody));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("should return validated params for authenticated account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });

    const result = await validateExecuteConnectorActionRequest(buildRequest(validBody));

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      accountId: "account-123",
      actionSlug: "GMAIL_FETCH_EMAILS",
      parameters: { max_results: 10 },
    });
  });

  it("should return target accountId when account_id provided + access granted", async () => {
    const target = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(checkAccountAccess).mockResolvedValue({ hasAccess: true, entityType: "artist" });

    const result = await validateExecuteConnectorActionRequest(
      buildRequest({ ...validBody, account_id: target }),
    );

    expect(checkAccountAccess).toHaveBeenCalledWith("account-123", target);
    expect(result).toEqual({
      accountId: target,
      actionSlug: "GMAIL_FETCH_EMAILS",
      parameters: { max_results: 10 },
    });
  });

  it("should return 403 when account_id provided + access denied", async () => {
    const target = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(checkAccountAccess).mockResolvedValue({ hasAccess: false });

    const result = await validateExecuteConnectorActionRequest(
      buildRequest({ ...validBody, account_id: target }),
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("should return 400 when body missing actionSlug", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });

    const result = await validateExecuteConnectorActionRequest(buildRequest({ parameters: {} }));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
