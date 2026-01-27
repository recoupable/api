import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetPulsesRequest } from "../validateGetPulsesRequest";

// Mock dependencies
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({
  getApiKeyAccountId: vi.fn(),
}));

vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: vi.fn(),
}));

vi.mock("@/lib/keys/getApiKeyDetails", () => ({
  getApiKeyDetails: vi.fn(),
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

import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

describe("validateGetPulsesRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error if no auth provided", async () => {
    const request = new NextRequest("http://localhost/api/pulses");
    const result = await validateGetPulsesRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
  });

  it("should return single account ID for personal key", async () => {
    const mockAccountId = "personal-account-123";
    vi.mocked(getApiKeyAccountId).mockResolvedValue(mockAccountId);
    vi.mocked(getApiKeyDetails).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null, // Personal key
    });

    const request = new NextRequest("http://localhost/api/pulses", {
      headers: { "x-api-key": "test-api-key" },
    });
    const result = await validateGetPulsesRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      accountIds: [mockAccountId],
      active: undefined,
    });
  });

  it("should return all org account IDs for org key", async () => {
    const mockOrgId = "org-123";
    vi.mocked(getApiKeyAccountId).mockResolvedValue(mockOrgId);
    vi.mocked(getApiKeyDetails).mockResolvedValue({
      accountId: mockOrgId,
      orgId: mockOrgId,
    });
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      { account_id: "member-1", organization_id: mockOrgId, organization: null },
      { account_id: "member-2", organization_id: mockOrgId, organization: null },
    ]);

    const request = new NextRequest("http://localhost/api/pulses", {
      headers: { "x-api-key": "test-api-key" },
    });
    const result = await validateGetPulsesRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    const validResult = result as { accountIds: string[]; active?: boolean };
    expect(validResult.accountIds).toContain("member-1");
    expect(validResult.accountIds).toContain("member-2");
    expect(validResult.accountIds).toContain(mockOrgId);
  });

  it("should return null accountIds for Recoup admin key", async () => {
    const recoupOrgId = "recoup-org-id";
    vi.mocked(getApiKeyAccountId).mockResolvedValue(recoupOrgId);
    vi.mocked(getApiKeyDetails).mockResolvedValue({
      accountId: recoupOrgId,
      orgId: recoupOrgId,
    });

    const request = new NextRequest("http://localhost/api/pulses", {
      headers: { "x-api-key": "recoup-admin-key" },
    });
    const result = await validateGetPulsesRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      accountIds: null,
      active: undefined,
    });
  });

  it("should parse active query parameter correctly", async () => {
    const mockAccountId = "account-123";
    vi.mocked(getApiKeyAccountId).mockResolvedValue(mockAccountId);
    vi.mocked(getApiKeyDetails).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null,
    });

    const request = new NextRequest("http://localhost/api/pulses?active=true", {
      headers: { "x-api-key": "test-api-key" },
    });
    const result = await validateGetPulsesRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    const validResult = result as { accountIds: string[]; active?: boolean };
    expect(validResult.active).toBe(true);
  });

  it("should reject invalid active query parameter", async () => {
    const mockAccountId = "account-123";
    vi.mocked(getApiKeyAccountId).mockResolvedValue(mockAccountId);
    vi.mocked(getApiKeyDetails).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null,
    });

    const request = new NextRequest("http://localhost/api/pulses?active=invalid", {
      headers: { "x-api-key": "test-api-key" },
    });
    const result = await validateGetPulsesRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should reject personal key trying to filter by account_id", async () => {
    const mockAccountId = "a1111111-1111-4111-8111-111111111111";
    const otherAccountId = "b2222222-2222-4222-8222-222222222222";
    vi.mocked(getApiKeyAccountId).mockResolvedValue(mockAccountId);
    vi.mocked(getApiKeyDetails).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null, // Personal key
    });

    const request = new NextRequest(
      `http://localhost/api/pulses?account_id=${otherAccountId}`,
      {
        headers: { "x-api-key": "test-api-key" },
      },
    );
    const result = await validateGetPulsesRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("should allow org key to filter by account_id within org", async () => {
    const mockOrgId = "c3333333-3333-4333-8333-333333333333";
    const targetAccountId = "d4444444-4444-4444-8444-444444444444";
    const member2Id = "e5555555-5555-4555-8555-555555555555";
    vi.mocked(getApiKeyAccountId).mockResolvedValue(mockOrgId);
    vi.mocked(getApiKeyDetails).mockResolvedValue({
      accountId: mockOrgId,
      orgId: mockOrgId,
    });
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      { account_id: targetAccountId, organization_id: mockOrgId, organization: null },
      { account_id: member2Id, organization_id: mockOrgId, organization: null },
    ]);

    const request = new NextRequest(
      `http://localhost/api/pulses?account_id=${targetAccountId}`,
      {
        headers: { "x-api-key": "test-api-key" },
      },
    );
    const result = await validateGetPulsesRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    const validResult = result as { accountIds: string[]; active?: boolean };
    expect(validResult.accountIds).toEqual([targetAccountId]);
  });

  it("should reject org key filtering by account_id not in org", async () => {
    const mockOrgId = "f6666666-6666-4666-8666-666666666666";
    const memberId = "a7777777-7777-4777-8777-777777777777";
    const notInOrgId = "b8888888-8888-4888-8888-888888888888";
    vi.mocked(getApiKeyAccountId).mockResolvedValue(mockOrgId);
    vi.mocked(getApiKeyDetails).mockResolvedValue({
      accountId: mockOrgId,
      orgId: mockOrgId,
    });
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      { account_id: memberId, organization_id: mockOrgId, organization: null },
    ]);

    const request = new NextRequest(
      `http://localhost/api/pulses?account_id=${notInOrgId}`,
      {
        headers: { "x-api-key": "test-api-key" },
      },
    );
    const result = await validateGetPulsesRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });
});
