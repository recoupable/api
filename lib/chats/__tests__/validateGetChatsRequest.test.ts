import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetChatsRequest } from "../validateGetChatsRequest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-org-id",
}));

describe("validateGetChatsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error if validateAuthContext fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/chats");
    const result = await validateGetChatsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("scopes personal key to the caller's account", async () => {
    const accountId = "personal-account-123";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/chats");
    const result = await validateGetChatsRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ accountIds: [accountId] });
  });

  it("scopes org key to the caller's org account (target unspecified)", async () => {
    const orgId = "org-123";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: orgId,
      orgId,
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/chats");
    const result = await validateGetChatsRequest(request);

    expect(result).toEqual({ accountIds: [orgId] });
  });

  it("returns undefined accountIds for Recoup admin (no target)", async () => {
    const recoupOrgId = "recoup-org-id";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: recoupOrgId,
      orgId: recoupOrgId,
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/chats");
    const result = await validateGetChatsRequest(request);

    expect(result).toEqual({ accountIds: undefined });
  });

  it("scopes admin to a specific account when account_id is supplied", async () => {
    const recoupOrgId = "recoup-org-id";
    const target = "a1111111-1111-4111-8111-111111111111";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: recoupOrgId,
      orgId: recoupOrgId,
      authToken: "test-token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const request = new NextRequest(`http://localhost/api/chats?account_id=${target}`);
    const result = await validateGetChatsRequest(request);

    expect(canAccessAccount).toHaveBeenCalledWith({
      targetAccountId: target,
      currentAccountId: recoupOrgId,
    });
    expect(result).toEqual({ accountIds: [target] });
  });

  it("rejects personal key trying to filter by account_id", async () => {
    const accountId = "a1111111-1111-4111-8111-111111111111";
    const other = "b2222222-2222-4222-8222-222222222222";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const request = new NextRequest(`http://localhost/api/chats?account_id=${other}`);
    const result = await validateGetChatsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("accepts but ignores artist_account_id (reserved for artist-surface migration)", async () => {
    const accountId = "personal-account-123";
    const artistId = "a1111111-1111-4111-8111-111111111111";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest(`http://localhost/api/chats?artist_account_id=${artistId}`);
    const result = await validateGetChatsRequest(request);

    expect(result).toEqual({ accountIds: [accountId] });
  });

  it("returns 400 for invalid artist_account_id UUID", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/chats?artist_account_id=invalid");
    const result = await validateGetChatsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
