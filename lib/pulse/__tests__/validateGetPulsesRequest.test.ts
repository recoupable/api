import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetPulsesRequest } from "../validateGetPulsesRequest";

// Mock dependencies
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

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

describe("validateGetPulsesRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error if auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/pulses");
    const result = await validateGetPulsesRequest(request);

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

  it("should return orgId for org key", async () => {
    const mockOrgId = "org-123";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockOrgId,
      orgId: mockOrgId,
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/pulses", {
      headers: { "x-api-key": "test-api-key" },
    });
    const result = await validateGetPulsesRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      orgId: mockOrgId,
      active: undefined,
    });
  });

  it("should return undefined accountIds for Recoup admin key", async () => {
    const recoupOrgId = "recoup-org-id";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: recoupOrgId,
      orgId: recoupOrgId,
      authToken: "test-token",
    });

    const request = new NextRequest("http://localhost/api/pulses", {
      headers: { "x-api-key": "recoup-admin-key" },
    });
    const result = await validateGetPulsesRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      accountIds: undefined,
      active: undefined,
    });
  });

  it("should parse active query parameter correctly", async () => {
    const mockAccountId = "account-123";
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null,
      authToken: "test-token",
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
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-token",
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
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockAccountId,
      orgId: null, // Personal key
      authToken: "test-token",
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
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: mockOrgId,
      orgId: mockOrgId,
      authToken: "test-token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const request = new NextRequest(
      `http://localhost/api/pulses?account_id=${targetAccountId}`,
      {
        headers: { "x-api-key": "test-api-key" },
      },
    );
    const result = await validateGetPulsesRequest(request);

    expect(canAccessAccount).toHaveBeenCalledWith({
      orgId: mockOrgId,
      targetAccountId,
    });
    expect(result).not.toBeInstanceOf(NextResponse);
    const validResult = result as { accountIds: string[]; active?: boolean };
    expect(validResult.accountIds).toEqual([targetAccountId]);
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

    const request = new NextRequest(
      `http://localhost/api/pulses?account_id=${notInOrgId}`,
      {
        headers: { "x-api-key": "test-api-key" },
      },
    );
    const result = await validateGetPulsesRequest(request);

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

    const request = new NextRequest(
      `http://localhost/api/pulses?account_id=${anyAccountId}`,
      {
        headers: { "x-api-key": "recoup-admin-key" },
      },
    );
    const result = await validateGetPulsesRequest(request);

    expect(canAccessAccount).toHaveBeenCalledWith({
      orgId: recoupOrgId,
      targetAccountId: anyAccountId,
    });
    expect(result).not.toBeInstanceOf(NextResponse);
    const validResult = result as { accountIds: string[]; active?: boolean };
    expect(validResult.accountIds).toEqual([anyAccountId]);
  });
});
