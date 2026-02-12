import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetArtistsRequest } from "../validateGetArtistsRequest";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

describe("validateGetArtistsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/artists");
    const result = await validateGetArtistsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns personal artists for personal key (no query params)", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "personal-123",
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/artists");
    const result = await validateGetArtistsRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      accountId: "personal-123",
      orgId: null,
    });
  });

  it("returns personal artists for org key (no query params)", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "org-owner-123",
      orgId: "org-123",
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/artists");
    const result = await validateGetArtistsRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      accountId: "org-owner-123",
      orgId: null,
    });
  });

  it("passes org_id filter through", async () => {
    const orgFilterId = "a1111111-1111-4111-8111-111111111111";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest(
      `http://localhost/api/artists?org_id=${orgFilterId}`,
    );
    const result = await validateGetArtistsRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      accountId: "account-123",
      orgId: orgFilterId,
    });
  });

  it("returns 400 for invalid account_id format", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest(
      "http://localhost/api/artists?account_id=not-a-uuid",
    );
    const result = await validateGetArtistsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 for invalid org_id format", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest(
      "http://localhost/api/artists?org_id=not-a-uuid",
    );
    const result = await validateGetArtistsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("allows org key to filter by account_id within org", async () => {
    const mockOrgId = "b2222222-2222-4222-8222-222222222222";
    const targetAccountId = "c3333333-3333-4333-8333-333333333333";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "org-owner",
      orgId: mockOrgId,
      authToken: "test-token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const request = new NextRequest(
      `http://localhost/api/artists?account_id=${targetAccountId}`,
    );
    const result = await validateGetArtistsRequest(request);

    expect(canAccessAccount).toHaveBeenCalledWith({
      orgId: mockOrgId,
      targetAccountId,
    });
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      accountId: targetAccountId,
      orgId: null,
    });
  });

  it("returns 403 when personal key tries to filter by account_id", async () => {
    const otherAccountId = "d4444444-4444-4444-8444-444444444444";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "personal-123",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const request = new NextRequest(
      `http://localhost/api/artists?account_id=${otherAccountId}`,
    );
    const result = await validateGetArtistsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns 403 when org key lacks access to account_id", async () => {
    const mockOrgId = "e5555555-5555-4555-8555-555555555555";
    const notInOrgId = "f6666666-6666-4666-8666-666666666666";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "org-owner",
      orgId: mockOrgId,
      authToken: "test-token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const request = new NextRequest(
      `http://localhost/api/artists?account_id=${notInOrgId}`,
    );
    const result = await validateGetArtistsRequest(request);

    expect(canAccessAccount).toHaveBeenCalledWith({
      orgId: mockOrgId,
      targetAccountId: notInOrgId,
    });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("combines account_id and org_id filters", async () => {
    const mockOrgId = "a1111111-1111-4111-8111-111111111111";
    const targetAccountId = "b2222222-2222-4222-8222-222222222222";
    const orgFilterId = "c3333333-3333-4333-8333-333333333333";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "org-owner",
      orgId: mockOrgId,
      authToken: "test-token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const request = new NextRequest(
      `http://localhost/api/artists?account_id=${targetAccountId}&org_id=${orgFilterId}`,
    );
    const result = await validateGetArtistsRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      accountId: targetAccountId,
      orgId: orgFilterId,
    });
  });
});
