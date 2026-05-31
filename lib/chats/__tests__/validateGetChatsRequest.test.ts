import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetChatsRequest } from "../validateGetChatsRequest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
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
    // Default: caller is NOT in the Recoup org. Admin tests override.
    vi.mocked(getAccountOrganizations).mockResolvedValue([]);
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

  it("scopes personal Bearer to the caller's account", async () => {
    const accountId = "personal-account-123";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/chats");
    const result = await validateGetChatsRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ accountIds: [accountId], artistAccountId: undefined });
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

    expect(result).toEqual({ accountIds: [orgId], artistAccountId: undefined });
  });

  it("returns undefined accountIds for Recoup admin (membership via account_organization_ids)", async () => {
    // Bearer-authed caller whose accountId is a member of RECOUP_ORG.
    // orgId stays null (Bearer never sets it) — the check goes through
    // account_organization_ids instead.
    const adminAccountId = "admin-account-123";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: adminAccountId,
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      // Only the organization_id field is read by the validator
      // — other AccountOrganization columns aren't accessed.
      { organization_id: "recoup-org-id" } as never,
    ]);

    const request = new NextRequest("http://localhost/api/chats");
    const result = await validateGetChatsRequest(request);

    expect(getAccountOrganizations).toHaveBeenCalledWith({ accountId: adminAccountId });
    expect(result).toEqual({ accountIds: undefined, artistAccountId: undefined });
  });

  it("scopes admin to a specific account when account_id is supplied", async () => {
    const adminAccountId = "admin-account-123";
    const target = "a1111111-1111-4111-8111-111111111111";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: adminAccountId,
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const request = new NextRequest(`http://localhost/api/chats?account_id=${target}`);
    const result = await validateGetChatsRequest(request);

    expect(canAccessAccount).toHaveBeenCalledWith({
      targetAccountId: target,
      currentAccountId: adminAccountId,
    });
    expect(result).toEqual({ accountIds: [target], artistAccountId: undefined });
  });

  it("rejects personal key trying to filter by account_id they can't access", async () => {
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

  it("passes artist_account_id through to the scope", async () => {
    const accountId = "personal-account-123";
    const artistAccountId = "a1111111-1111-4111-8111-111111111111";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest(
      `http://localhost/api/chats?artist_account_id=${artistAccountId}`,
    );
    const result = await validateGetChatsRequest(request);

    expect(result).toEqual({ accountIds: [accountId], artistAccountId });
  });

  it("composes account_id + artist_account_id when both supplied", async () => {
    const callerAccountId = "caller-account-123";
    const target = "a1111111-1111-4111-8111-111111111111";
    const artistAccountId = "c3333333-3333-4333-8333-333333333333";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: callerAccountId,
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const request = new NextRequest(
      `http://localhost/api/chats?account_id=${target}&artist_account_id=${artistAccountId}`,
    );
    const result = await validateGetChatsRequest(request);

    expect(result).toEqual({ accountIds: [target], artistAccountId });
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
