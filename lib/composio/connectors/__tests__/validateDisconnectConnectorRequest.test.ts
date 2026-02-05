import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateDisconnectConnectorRequest } from "../validateDisconnectConnectorRequest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/supabase/account_artist_ids/checkAccountArtistAccess";
import { verifyConnectorOwnership } from "../verifyConnectorOwnership";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/account_artist_ids/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

vi.mock("../verifyConnectorOwnership", () => ({
  verifyConnectorOwnership: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

describe("validateDisconnectConnectorRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error if auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
      body: JSON.stringify({ connected_account_id: "ca_123" }),
    });
    const result = await validateDisconnectConnectorRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
  });

  it("should verify ownership when no account_id provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(verifyConnectorOwnership).mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
      body: JSON.stringify({ connected_account_id: "ca_123" }),
    });
    const result = await validateDisconnectConnectorRequest(request);

    expect(verifyConnectorOwnership).toHaveBeenCalledWith("account-123", "ca_123");
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      connectedAccountId: "ca_123",
      entityId: undefined,
    });
  });

  it("should return 403 when ownership verification fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(verifyConnectorOwnership).mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
      body: JSON.stringify({ connected_account_id: "ca_123" }),
    });
    const result = await validateDisconnectConnectorRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("should check entity access when account_id provided", async () => {
    const mockEntityId = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
      body: JSON.stringify({ connected_account_id: "ca_123", account_id: mockEntityId }),
    });
    const result = await validateDisconnectConnectorRequest(request);

    expect(checkAccountArtistAccess).toHaveBeenCalledWith("account-123", mockEntityId);
    expect(verifyConnectorOwnership).not.toHaveBeenCalled();
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      connectedAccountId: "ca_123",
      entityId: mockEntityId,
    });
  });

  it("should return 403 when entity access denied", async () => {
    const mockEntityId = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
      body: JSON.stringify({ connected_account_id: "ca_123", account_id: mockEntityId }),
    });
    const result = await validateDisconnectConnectorRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });
});
