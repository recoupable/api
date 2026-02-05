import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAuthorizeConnectorRequest } from "../validateAuthorizeConnectorRequest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/supabase/account_artist_ids/checkAccountArtistAccess";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/account_artist_ids/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

describe("validateAuthorizeConnectorRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error if auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
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

  it("should return accountId as composioEntityId when no account_id", async () => {
    const mockAccountId = "account-123";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null,
      authToken: "test-token",
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
    });
  });

  it("should return account_id as composioEntityId when account_id provided", async () => {
    const mockAccountId = "account-123";
    const mockEntityId = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/connectors/authorize", {
      method: "POST",
      body: JSON.stringify({ connector: "tiktok", account_id: mockEntityId }),
    });
    const result = await validateAuthorizeConnectorRequest(request);

    expect(checkAccountArtistAccess).toHaveBeenCalledWith(mockAccountId, mockEntityId);
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      composioEntityId: mockEntityId,
      connector: "tiktok",
      callbackUrl: undefined,
      authConfigs: undefined,
    });
  });

  it("should return 403 when account_id provided but no access", async () => {
    const mockAccountId = "account-123";
    const mockEntityId = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/connectors/authorize", {
      method: "POST",
      body: JSON.stringify({ connector: "tiktok", account_id: mockEntityId }),
    });
    const result = await validateAuthorizeConnectorRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("should include TikTok auth config when connector is tiktok and env var is set", async () => {
    const mockAccountId = "account-123";
    const mockEntityId = "550e8400-e29b-41d4-a716-446655440000";
    const originalEnv = process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID;
    process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID = "ac_test123";

    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/connectors/authorize", {
      method: "POST",
      body: JSON.stringify({ connector: "tiktok", account_id: mockEntityId }),
    });
    const result = await validateAuthorizeConnectorRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as { authConfigs?: Record<string, string> }).authConfigs).toEqual({
      tiktok: "ac_test123",
    });

    process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID = originalEnv;
  });
});
