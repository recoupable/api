import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAuthorizeConnectorRequest } from "../validateAuthorizeConnectorRequest";

// Mock dependencies
vi.mock("@/lib/accounts/validateAccountIdHeaders", () => ({
  validateAccountIdHeaders: vi.fn(),
}));

vi.mock("@/lib/supabase/account_artist_ids/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

import { validateAccountIdHeaders } from "@/lib/accounts/validateAccountIdHeaders";
import { checkAccountArtistAccess } from "@/lib/supabase/account_artist_ids/checkAccountArtistAccess";

describe("validateAuthorizeConnectorRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error if auth fails", async () => {
    vi.mocked(validateAccountIdHeaders).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/connectors/authorize", {
      method: "POST",
      body: JSON.stringify({ connector: "googlesheets" }),
    });
    const result = await validateAuthorizeConnectorRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
  });

  it("should return params for user connector", async () => {
    const mockAccountId = "account-123";
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: mockAccountId,
    });

    const request = new NextRequest("http://localhost/api/connectors/authorize", {
      method: "POST",
      body: JSON.stringify({ connector: "googlesheets" }),
    });
    const result = await validateAuthorizeConnectorRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      composioEntityId: mockAccountId,
      connector: "googlesheets",
      callbackUrl: undefined,
      entityType: "user",
    });
  });

  it("should return params for artist connector with access", async () => {
    const mockAccountId = "account-123";
    const mockArtistId = "artist-456";
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: mockAccountId,
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/connectors/authorize", {
      method: "POST",
      body: JSON.stringify({
        connector: "tiktok",
        entity_type: "artist",
        entity_id: mockArtistId,
      }),
    });
    const result = await validateAuthorizeConnectorRequest(request);

    expect(checkAccountArtistAccess).toHaveBeenCalledWith(mockAccountId, mockArtistId);
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toMatchObject({
      composioEntityId: mockArtistId,
      connector: "tiktok",
      entityType: "artist",
    });
  });

  it("should return 403 for artist connector without access", async () => {
    const mockAccountId = "account-123";
    const mockArtistId = "artist-456";
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: mockAccountId,
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/connectors/authorize", {
      method: "POST",
      body: JSON.stringify({
        connector: "tiktok",
        entity_type: "artist",
        entity_id: mockArtistId,
      }),
    });
    const result = await validateAuthorizeConnectorRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("should return 400 if connector is not allowed for artists", async () => {
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: "account-123",
    });

    const request = new NextRequest("http://localhost/api/connectors/authorize", {
      method: "POST",
      body: JSON.stringify({
        connector: "googlesheets", // Not allowed for artists
        entity_type: "artist",
        entity_id: "artist-456",
      }),
    });
    const result = await validateAuthorizeConnectorRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should return 400 if entity_id is missing for artist", async () => {
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: "account-123",
    });

    const request = new NextRequest("http://localhost/api/connectors/authorize", {
      method: "POST",
      body: JSON.stringify({
        connector: "tiktok",
        entity_type: "artist",
        // entity_id missing
      }),
    });
    const result = await validateAuthorizeConnectorRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should return 400 if connector is missing", async () => {
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: "account-123",
    });

    const request = new NextRequest("http://localhost/api/connectors/authorize", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const result = await validateAuthorizeConnectorRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });
});
