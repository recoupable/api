import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { validateAuthContext } from "../validateAuthContext";

import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
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

vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

const mockGetApiKeyAccountId = vi.mocked(getApiKeyAccountId);
const mockGetAuthenticatedAccountId = vi.mocked(getAuthenticatedAccountId);
const mockValidateOrganizationAccess = vi.mocked(validateOrganizationAccess);
const mockCanAccessAccount = vi.mocked(canAccessAccount);

/**
 * Creates a minimal mock Request object with the given headers for testing auth validation.
 *
 * @param headers - Key-value pairs of HTTP headers to include on the mock request
 * @returns A minimal Request-shaped object suitable for passing to validateAuthContext
 */
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

      const result = await validateAuthContext(request as never);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountId: "account-123",
        orgId: null,
        authToken: "valid-api-key",
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
      const request = createMockRequest({
        authorization: "Bearer valid-token",
      });
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
      const request = createMockRequest({
        authorization: "Bearer my-token-123",
      });
      mockGetAuthenticatedAccountId.mockResolvedValue("account-123");

      const result = await validateAuthContext(request as never);

      expect(result).not.toBeInstanceOf(NextResponse);
      const authContext = result as { authToken: string };
      expect(authContext.authToken).toBe("my-token-123");
    });
  });

  describe("account_id override", () => {
    it("allows self-access without calling canAccessAccount", async () => {
      const request = createMockRequest({ "x-api-key": "personal-key" });
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const result = await validateAuthContext(request as never, {
        accountId: "account-123",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountId: "account-123",
        orgId: null,
        authToken: "personal-key",
      });
      expect(mockCanAccessAccount).not.toHaveBeenCalled();
    });

    it("allows access to different account_id when canAccessAccount returns true", async () => {
      const request = createMockRequest({ "x-api-key": "personal-key" });
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockCanAccessAccount.mockResolvedValue(true);

      const result = await validateAuthContext(request as never, {
        accountId: "member-account-456",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountId: "member-account-456",
        orgId: null,
        authToken: "personal-key",
      });
      expect(mockCanAccessAccount).toHaveBeenCalledWith({
        targetAccountId: "member-account-456",
        currentAccountId: "account-123",
      });
    });

    it("denies access to different account_id when canAccessAccount returns false", async () => {
      const request = createMockRequest({ "x-api-key": "personal-key" });
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockCanAccessAccount.mockResolvedValue(false);

      const result = await validateAuthContext(request as never, {
        accountId: "different-account-456",
      });

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("Access denied to specified account_id");
    });
  });

  describe("organization_id validation", () => {
    it("sets orgId from organizationId when account is a member", async () => {
      const request = createMockRequest({ "x-api-key": "personal-key" });
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockValidateOrganizationAccess.mockResolvedValue(true);

      const result = await validateAuthContext(request as never, {
        organizationId: "org-789",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountId: "account-123",
        orgId: "org-789",
        authToken: "personal-key",
      });
    });

    it("denies access when account is NOT a member of the organization", async () => {
      const request = createMockRequest({ "x-api-key": "personal-key" });
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
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

      const result = await validateAuthContext(request as never, {
        organizationId: null,
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(mockValidateOrganizationAccess).not.toHaveBeenCalled();
    });
  });

  describe("combined account_id and organization_id validation", () => {
    it("validates organization access using the overridden accountId", async () => {
      const request = createMockRequest({ "x-api-key": "personal-key" });
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockCanAccessAccount.mockResolvedValue(true);
      mockValidateOrganizationAccess.mockResolvedValue(true);

      const result = await validateAuthContext(request as never, {
        accountId: "member-account-456",
        organizationId: "org-789",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(mockValidateOrganizationAccess).toHaveBeenCalledWith({
        accountId: "member-account-456",
        organizationId: "org-789",
      });
      expect(result).toEqual({
        accountId: "member-account-456",
        orgId: "org-789",
        authToken: "personal-key",
      });
    });
  });
});
