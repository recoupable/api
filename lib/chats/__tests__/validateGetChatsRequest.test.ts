import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetChatsRequest } from "../validateGetChatsRequest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

// Mock dependencies
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
  });

  it("should return error if auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/chats");
    const result = await validateGetChatsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
  });

  it("should return single account ID for personal key", async () => {
    const mockAccountId = "personal-account-123";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null, // Personal key
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/chats", {
      headers: { "x-api-key": "test-api-key" },
    });
    const result = await validateGetChatsRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      account_ids: [mockAccountId],
      artist_id: undefined,
    });
  });

  it("should return org member account_ids for org key", async () => {
    const mockOrgId = "org-123";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockOrgId,
      orgId: mockOrgId,
      authToken: "test-token",
    });
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      { account_id: "member-1", organization_id: mockOrgId, organization: null },
      { account_id: "member-2", organization_id: mockOrgId, organization: null },
    ]);

    const request = new NextRequest("http://localhost/api/chats", {
      headers: { "x-api-key": "test-api-key" },
    });
    const result = await validateGetChatsRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      account_ids: ["member-1", "member-2"],
      artist_id: undefined,
    });
  });

  it("should return undefined account_ids for Recoup admin key", async () => {
    const recoupOrgId = "recoup-org-id";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: recoupOrgId,
      orgId: recoupOrgId,
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/chats", {
      headers: { "x-api-key": "recoup-admin-key" },
    });
    const result = await validateGetChatsRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      account_ids: undefined,
      artist_id: undefined,
    });
  });

  it("should parse artist_account_id query parameter correctly", async () => {
    const mockAccountId = "account-123";
    const artistId = "a1111111-1111-4111-8111-111111111111";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest(`http://localhost/api/chats?artist_account_id=${artistId}`, {
      headers: { "x-api-key": "test-api-key" },
    });
    const result = await validateGetChatsRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      account_ids: [mockAccountId],
      artist_id: artistId,
    });
  });

  it("should reject invalid artist_account_id query parameter", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/chats?artist_account_id=invalid", {
      headers: { "x-api-key": "test-api-key" },
    });
    const result = await validateGetChatsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should reject personal key trying to filter by account_id", async () => {
    const mockAccountId = "a1111111-1111-4111-8111-111111111111";
    const otherAccountId = "b2222222-2222-4222-8222-222222222222";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null, // Personal key
      authToken: "test-token",
    });

    const request = new NextRequest(`http://localhost/api/chats?account_id=${otherAccountId}`, {
      headers: { "x-api-key": "test-api-key" },
    });
    const result = await validateGetChatsRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("should allow org key to filter by account_id within org", async () => {
    const mockOrgId = "c3333333-3333-4333-8333-333333333333";
    const targetAccountId = "d4444444-4444-4444-8444-444444444444";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockOrgId,
      orgId: mockOrgId,
      authToken: "test-token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const request = new NextRequest(`http://localhost/api/chats?account_id=${targetAccountId}`, {
      headers: { "x-api-key": "test-api-key" },
    });
    const result = await validateGetChatsRequest(request);

    expect(canAccessAccount).toHaveBeenCalledWith({
      orgId: mockOrgId,
      targetAccountId,
    });
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      account_ids: [targetAccountId],
      artist_id: undefined,
    });
  });

  it("should reject org key filtering by account_id not in org", async () => {
    const mockOrgId = "f6666666-6666-4666-8666-666666666666";
    const notInOrgId = "b8888888-8888-4888-8888-888888888888";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockOrgId,
      orgId: mockOrgId,
      authToken: "test-token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const request = new NextRequest(`http://localhost/api/chats?account_id=${notInOrgId}`, {
      headers: { "x-api-key": "test-api-key" },
    });
    const result = await validateGetChatsRequest(request);

    expect(canAccessAccount).toHaveBeenCalledWith({
      orgId: mockOrgId,
      targetAccountId: notInOrgId,
    });
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("should allow Recoup admin to filter by any account_id", async () => {
    const recoupOrgId = "recoup-org-id";
    const anyAccountId = "a1111111-1111-4111-8111-111111111111";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: recoupOrgId,
      orgId: recoupOrgId,
      authToken: "test-token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(true); // Admin always has access

    const request = new NextRequest(`http://localhost/api/chats?account_id=${anyAccountId}`, {
      headers: { "x-api-key": "recoup-admin-key" },
    });
    const result = await validateGetChatsRequest(request);

    expect(canAccessAccount).toHaveBeenCalledWith({
      orgId: recoupOrgId,
      targetAccountId: anyAccountId,
    });
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      account_ids: [anyAccountId],
      artist_id: undefined,
    });
  });

  it("should allow combining account_id and artist_account_id filters", async () => {
    const mockOrgId = "c3333333-3333-4333-8333-333333333333";
    const targetAccountId = "d4444444-4444-4444-8444-444444444444";
    const artistId = "e5555555-5555-4555-8555-555555555555";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockOrgId,
      orgId: mockOrgId,
      authToken: "test-token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const request = new NextRequest(
      `http://localhost/api/chats?account_id=${targetAccountId}&artist_account_id=${artistId}`,
      {
        headers: { "x-api-key": "test-api-key" },
      },
    );
    const result = await validateGetChatsRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      account_ids: [targetAccountId],
      artist_id: artistId,
    });
  });
});
