import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { validateAuthContext } from "../validateAuthContext";

import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

// Mock dependencies
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

vi.mock("@/lib/auth/getApiKeyAccountId", () => ({
  getApiKeyAccountId: vi.fn(),
}));

vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: vi.fn(),
}));

vi.mock("@/lib/keys/getApiKeyDetails", () => ({
  getApiKeyDetails: vi.fn(),
}));

vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

const mockGetApiKeyAccountId = vi.mocked(getApiKeyAccountId);
const mockGetAuthenticatedAccountId = vi.mocked(getAuthenticatedAccountId);
const mockGetApiKeyDetails = vi.mocked(getApiKeyDetails);
const mockValidateOrganizationAccess = vi.mocked(validateOrganizationAccess);
const mockCanAccessAccount = vi.mocked(canAccessAccount);

function createMockRequest(headers: Record<string, string> = {}): Request {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
  } as unknown as Request;
}

describe("validateAuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication mechanism validation", () => {
    it("returns 401 when neither x-api-key nor Authorization is provided", async () => {
      const request = createMockRequest({});

      const result = await validateAuthContext(request as never);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Exactly one of x-api-key or Authorization must be provided");
    });

    it("returns 401 when both x-api-key and Authorization are provided", async () => {
      const request = createMockRequest({
        "x-api-key": "test-api-key",
        authorization: "Bearer test-token",
      });

      const result = await validateAuthContext(request as never);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(401);
    });
  });

  describe("API key authentication", () => {
    it("returns accountId from API key when valid", async () => {
      const request = createMockRequest({ "x-api-key": "valid-api-key" });
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        name: "test-key",
      });

      const result = await validateAuthContext(request as never);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountId: "account-123",
        orgId: null,
        authToken: "valid-api-key",
      });
    });

    it("returns orgId from API key details when present", async () => {
      const request = createMockRequest({ "x-api-key": "org-api-key" });
      mockGetApiKeyAccountId.mockResolvedValue("org-account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "org-account-123",
        orgId: "org-456",
        name: "org-key",
      });

      const result = await validateAuthContext(request as never);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountId: "org-account-123",
        orgId: "org-456",
        authToken: "org-api-key",
      });
    });

    it("returns error response when API key is invalid", async () => {
      const request = createMockRequest({ "x-api-key": "invalid-key" });
      mockGetApiKeyAccountId.mockResolvedValue(
        NextResponse.json({ error: "Invalid API key" }, { status: 401 }),
      );

      const result = await validateAuthContext(request as never);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
    });
  });

  describe("Bearer token authentication", () => {
    it("returns accountId from bearer token when valid", async () => {
      const request = createMockRequest({ authorization: "Bearer valid-token" });
      mockGetAuthenticatedAccountId.mockResolvedValue("bearer-account-123");

      const result = await validateAuthContext(request as never);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountId: "bearer-account-123",
        orgId: null,
        authToken: "valid-token",
      });
    });

    it("strips Bearer prefix from auth token", async () => {
      const request = createMockRequest({ authorization: "Bearer my-token-123" });
      mockGetAuthenticatedAccountId.mockResolvedValue("account-123");

      const result = await validateAuthContext(request as never);

      expect(result).not.toBeInstanceOf(NextResponse);
      const authContext = result as { authToken: string };
      expect(authContext.authToken).toBe("my-token-123");
    });
  });

  describe("account_id override", () => {
    it("allows personal API key to specify own account_id (self-access)", async () => {
      const request = createMockRequest({ "x-api-key": "personal-key" });
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        name: "personal-key",
      });

      const result = await validateAuthContext(request as never, {
        accountId: "account-123", // Same as the API key's account
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountId: "account-123",
        orgId: null,
        authToken: "personal-key",
      });
      // Should not call canAccessAccount for self-access
      expect(mockCanAccessAccount).not.toHaveBeenCalled();
    });

    it("denies personal API key accessing different account_id", async () => {
      const request = createMockRequest({ "x-api-key": "personal-key" });
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        name: "personal-key",
      });

      const result = await validateAuthContext(request as never, {
        accountId: "different-account-456", // Different from API key's account
      });

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("Access denied to specified account_id");
    });

    it("allows org API key to access member account", async () => {
      const request = createMockRequest({ "x-api-key": "org-key" });
      mockGetApiKeyAccountId.mockResolvedValue("org-account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "org-account-123",
        orgId: "org-456",
        name: "org-key",
      });
      mockCanAccessAccount.mockResolvedValue(true);

      const result = await validateAuthContext(request as never, {
        accountId: "member-account-789",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountId: "member-account-789",
        orgId: "org-456",
        authToken: "org-key",
      });
      expect(mockCanAccessAccount).toHaveBeenCalledWith({
        orgId: "org-456",
        targetAccountId: "member-account-789",
      });
    });

    it("denies org API key accessing non-member account", async () => {
      const request = createMockRequest({ "x-api-key": "org-key" });
      mockGetApiKeyAccountId.mockResolvedValue("org-account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "org-account-123",
        orgId: "org-456",
        name: "org-key",
      });
      mockCanAccessAccount.mockResolvedValue(false);

      const result = await validateAuthContext(request as never, {
        accountId: "non-member-account",
      });

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(403);
    });
  });

  describe("organization_id validation", () => {
    it("allows access when account is a member of the organization", async () => {
      const request = createMockRequest({ "x-api-key": "personal-key" });
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        name: "personal-key",
      });
      mockValidateOrganizationAccess.mockResolvedValue(true);

      const result = await validateAuthContext(request as never, {
        organizationId: "org-789",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountId: "account-123",
        orgId: "org-789", // orgId is set from organizationId input
        authToken: "personal-key",
      });
      expect(mockValidateOrganizationAccess).toHaveBeenCalledWith({
        accountId: "account-123",
        organizationId: "org-789",
      });
    });

    it("denies access when account is NOT a member of the organization", async () => {
      const request = createMockRequest({ "x-api-key": "personal-key" });
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        name: "personal-key",
      });
      mockValidateOrganizationAccess.mockResolvedValue(false);

      const result = await validateAuthContext(request as never, {
        organizationId: "org-not-member",
      });

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("Access denied to specified organization_id");
    });

    it("skips organization validation when organizationId is null", async () => {
      const request = createMockRequest({ "x-api-key": "personal-key" });
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        name: "personal-key",
      });

      const result = await validateAuthContext(request as never, {
        organizationId: null,
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(mockValidateOrganizationAccess).not.toHaveBeenCalled();
    });
  });

  describe("combined account_id and organization_id validation", () => {
    it("validates organization access using the overridden accountId", async () => {
      const request = createMockRequest({ "x-api-key": "org-key" });
      mockGetApiKeyAccountId.mockResolvedValue("org-admin-account");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "org-admin-account",
        orgId: "org-123",
        name: "org-key",
      });
      mockCanAccessAccount.mockResolvedValue(true);
      mockValidateOrganizationAccess.mockResolvedValue(true);

      const result = await validateAuthContext(request as never, {
        accountId: "member-account-456",
        organizationId: "different-org-789",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      // Verify that organization access was validated with the overridden accountId
      expect(mockValidateOrganizationAccess).toHaveBeenCalledWith({
        accountId: "member-account-456", // The overridden account
        organizationId: "different-org-789",
      });
    });
  });
});
