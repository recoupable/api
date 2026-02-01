import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateDisconnectConnectorRequest } from "../validateDisconnectConnectorRequest";

// Mock dependencies
vi.mock("@/lib/accounts/validateAccountIdHeaders", () => ({
  validateAccountIdHeaders: vi.fn(),
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

import { validateAccountIdHeaders } from "@/lib/accounts/validateAccountIdHeaders";
import { checkAccountArtistAccess } from "@/lib/supabase/account_artist_ids/checkAccountArtistAccess";
import { verifyConnectorOwnership } from "../verifyConnectorOwnership";

describe("validateDisconnectConnectorRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error if auth fails", async () => {
    vi.mocked(validateAccountIdHeaders).mockResolvedValue(
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

  it("should return params for user disconnect with ownership", async () => {
    const mockAccountId = "account-123";
    const mockConnectedAccountId = "ca_456";
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: mockAccountId,
    });
    vi.mocked(verifyConnectorOwnership).mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
      body: JSON.stringify({ connected_account_id: mockConnectedAccountId }),
    });
    const result = await validateDisconnectConnectorRequest(request);

    expect(verifyConnectorOwnership).toHaveBeenCalledWith(mockAccountId, mockConnectedAccountId);
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      accountId: mockAccountId,
      connectedAccountId: mockConnectedAccountId,
      entityType: "user",
      entityId: undefined,
    });
  });

  it("should return 403 for user disconnect without ownership", async () => {
    const mockAccountId = "account-123";
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: mockAccountId,
    });
    vi.mocked(verifyConnectorOwnership).mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
      body: JSON.stringify({ connected_account_id: "ca_456" }),
    });
    const result = await validateDisconnectConnectorRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("should return params for artist disconnect with access", async () => {
    const mockAccountId = "account-123";
    const mockArtistId = "artist-456";
    const mockConnectedAccountId = "ca_789";
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: mockAccountId,
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
      body: JSON.stringify({
        connected_account_id: mockConnectedAccountId,
        entity_type: "artist",
        entity_id: mockArtistId,
      }),
    });
    const result = await validateDisconnectConnectorRequest(request);

    expect(checkAccountArtistAccess).toHaveBeenCalledWith(mockAccountId, mockArtistId);
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      accountId: mockAccountId,
      connectedAccountId: mockConnectedAccountId,
      entityType: "artist",
      entityId: mockArtistId,
    });
  });

  it("should return 403 for artist disconnect without access", async () => {
    const mockAccountId = "account-123";
    const mockArtistId = "artist-456";
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: mockAccountId,
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
      body: JSON.stringify({
        connected_account_id: "ca_789",
        entity_type: "artist",
        entity_id: mockArtistId,
      }),
    });
    const result = await validateDisconnectConnectorRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("should return 400 if connected_account_id is missing", async () => {
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: "account-123",
    });

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
      body: JSON.stringify({}),
    });
    const result = await validateDisconnectConnectorRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should return 400 if entity_id is missing for artist", async () => {
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: "account-123",
    });

    const request = new NextRequest("http://localhost/api/connectors", {
      method: "DELETE",
      body: JSON.stringify({
        connected_account_id: "ca_456",
        entity_type: "artist",
        // entity_id missing
      }),
    });
    const result = await validateDisconnectConnectorRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });
});
