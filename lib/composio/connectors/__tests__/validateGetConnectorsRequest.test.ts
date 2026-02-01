import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetConnectorsRequest } from "../validateGetConnectorsRequest";

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

describe("validateGetConnectorsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error if auth fails", async () => {
    vi.mocked(validateAccountIdHeaders).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/connectors");
    const result = await validateGetConnectorsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
  });

  it("should return accountId for user entity type (default)", async () => {
    const mockAccountId = "account-123";
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: mockAccountId,
    });

    const request = new NextRequest("http://localhost/api/connectors");
    const result = await validateGetConnectorsRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      composioEntityId: mockAccountId,
    });
  });

  it("should return artistId for artist entity type with access", async () => {
    const mockAccountId = "account-123";
    const mockArtistId = "artist-456";
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: mockAccountId,
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);

    const request = new NextRequest(
      `http://localhost/api/connectors?entity_type=artist&entity_id=${mockArtistId}`,
    );
    const result = await validateGetConnectorsRequest(request);

    expect(checkAccountArtistAccess).toHaveBeenCalledWith(mockAccountId, mockArtistId);
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      composioEntityId: mockArtistId,
      allowedToolkits: ["tiktok"],
    });
  });

  it("should return 403 for artist entity type without access", async () => {
    const mockAccountId = "account-123";
    const mockArtistId = "artist-456";
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: mockAccountId,
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const request = new NextRequest(
      `http://localhost/api/connectors?entity_type=artist&entity_id=${mockArtistId}`,
    );
    const result = await validateGetConnectorsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("should return 400 if entity_type is artist but entity_id is missing", async () => {
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: "account-123",
    });

    const request = new NextRequest(
      "http://localhost/api/connectors?entity_type=artist",
    );
    const result = await validateGetConnectorsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should reject invalid entity_type", async () => {
    vi.mocked(validateAccountIdHeaders).mockResolvedValue({
      accountId: "account-123",
    });

    const request = new NextRequest(
      "http://localhost/api/connectors?entity_type=invalid",
    );
    const result = await validateGetConnectorsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });
});
