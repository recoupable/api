import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { validateChatAuth } from "../validateChatAuth";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { validateOverrideAccountId } from "@/lib/accounts/validateOverrideAccountId";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";

// Mock dependencies
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({
  getApiKeyAccountId: vi.fn(),
}));

vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: vi.fn(),
}));

vi.mock("@/lib/accounts/validateOverrideAccountId", () => ({
  validateOverrideAccountId: vi.fn(),
}));

vi.mock("@/lib/keys/getApiKeyDetails", () => ({
  getApiKeyDetails: vi.fn(),
}));

vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));

const mockGetApiKeyAccountId = vi.mocked(getApiKeyAccountId);
const mockGetAuthenticatedAccountId = vi.mocked(getAuthenticatedAccountId);
const mockValidateOverrideAccountId = vi.mocked(validateOverrideAccountId);
const mockGetApiKeyDetails = vi.mocked(getApiKeyDetails);
const mockValidateOrganizationAccess = vi.mocked(validateOrganizationAccess);

/**
 * Helper to create mock NextRequest.
 *
 * @param body - The request body to mock.
 * @param headers - The headers to include in the mock request.
 * @returns A mock Request object.
 */
function createMockRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return {
    json: () => Promise.resolve(body),
    headers: {
      get: (key: string) => headers[key.toLowerCase()] || null,
      has: (key: string) => key.toLowerCase() in headers,
    },
  } as unknown as Request;
}

describe("validateChatAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("schema validation", () => {
    it("accepts valid request with prompt", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "test-key" });

      const result = await validateChatAuth(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).body.prompt).toBe("Hello");
    });

    it("accepts valid request with messages", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const messages = [{ role: "user", content: "Hello" }];
      const request = createMockRequest({ messages }, { "x-api-key": "test-key" });

      const result = await validateChatAuth(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).body.messages).toEqual(messages);
    });

    it("accepts valid request with optional fields", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        {
          prompt: "Hello",
          roomId: "room-123",
          artistId: "artist-456",
          model: "gpt-4",
          excludeTools: ["tool1"],
        },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatAuth(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).body.roomId).toBe("room-123");
      expect((result as any).body.artistId).toBe("artist-456");
      expect((result as any).body.model).toBe("gpt-4");
      expect((result as any).body.excludeTools).toEqual(["tool1"]);
    });
  });

  describe("authentication", () => {
    it("rejects request without any auth header", async () => {
      const request = createMockRequest({ prompt: "Hello" }, {});

      const result = await validateChatAuth(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Exactly one of x-api-key or Authorization must be provided");
    });

    it("rejects request with both x-api-key and Authorization headers", async () => {
      const request = createMockRequest(
        { prompt: "Hello" },
        { "x-api-key": "test-key", authorization: "Bearer test-token" },
      );

      const result = await validateChatAuth(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Exactly one of x-api-key or Authorization must be provided");
    });

    it("uses accountId from valid API key", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-abc-123");

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "valid-key" });

      const result = await validateChatAuth(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("account-abc-123");
    });

    it("rejects request with invalid API key", async () => {
      mockGetApiKeyAccountId.mockResolvedValue(
        NextResponse.json({ status: "error", message: "Invalid API key" }, { status: 401 }),
      );

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "invalid-key" });

      const result = await validateChatAuth(request as any);

      expect(result).toBeInstanceOf(NextResponse);
    });

    it("accepts valid Authorization Bearer token", async () => {
      mockGetAuthenticatedAccountId.mockResolvedValue("account-from-jwt-456");

      const request = createMockRequest(
        { prompt: "Hello" },
        { authorization: "Bearer valid-jwt-token" },
      );

      const result = await validateChatAuth(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("account-from-jwt-456");
    });

    it("rejects request with invalid Authorization token", async () => {
      mockGetAuthenticatedAccountId.mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Failed to verify authentication token" },
          { status: 401 },
        ),
      );

      const request = createMockRequest(
        { prompt: "Hello" },
        { authorization: "Bearer invalid-token" },
      );

      const result = await validateChatAuth(request as any);

      expect(result).toBeInstanceOf(NextResponse);
    });
  });

  describe("org context", () => {
    it("returns orgId for org API key", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("org-account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "org-account-123",
        orgId: "org-account-123",
      });

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "org-api-key" });

      const result = await validateChatAuth(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).orgId).toBe("org-account-123");
    });

    it("returns null orgId for personal API key", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("personal-account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "personal-account-123",
        orgId: null,
      });

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "personal-api-key" });

      const result = await validateChatAuth(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).orgId).toBeNull();
    });

    it("returns null orgId for bearer token auth", async () => {
      mockGetAuthenticatedAccountId.mockResolvedValue("jwt-account-456");

      const request = createMockRequest(
        { prompt: "Hello" },
        { authorization: "Bearer valid-jwt-token" },
      );

      const result = await validateChatAuth(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).orgId).toBeNull();
    });
  });

  describe("accountId override", () => {
    it("allows org API key to override accountId", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("org-account-123");
      mockValidateOverrideAccountId.mockResolvedValue({
        accountId: "target-account-456",
      });

      const request = createMockRequest(
        { prompt: "Hello", accountId: "target-account-456" },
        { "x-api-key": "org-api-key" },
      );

      const result = await validateChatAuth(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("target-account-456");
      expect(mockValidateOverrideAccountId).toHaveBeenCalledWith({
        apiKey: "org-api-key",
        targetAccountId: "target-account-456",
      });
    });

    it("rejects unauthorized accountId override", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("personal-account-123");
      mockValidateOverrideAccountId.mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Access denied to specified accountId" },
          { status: 403 },
        ),
      );

      const request = createMockRequest(
        { prompt: "Hello", accountId: "target-account-456" },
        { "x-api-key": "personal-api-key" },
      );

      const result = await validateChatAuth(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Access denied to specified accountId");
    });
  });

  describe("organizationId override", () => {
    it("uses provided organizationId when user is member of org", async () => {
      mockGetAuthenticatedAccountId.mockResolvedValue("user-account-123");
      mockValidateOrganizationAccess.mockResolvedValue(true);

      const request = createMockRequest(
        { prompt: "Hello", organizationId: "org-456" },
        { authorization: "Bearer valid-jwt-token" },
      );

      const result = await validateChatAuth(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).orgId).toBe("org-456");
      expect(mockValidateOrganizationAccess).toHaveBeenCalledWith({
        accountId: "user-account-123",
        organizationId: "org-456",
      });
    });

    it("rejects organizationId when user is NOT a member of org", async () => {
      mockGetAuthenticatedAccountId.mockResolvedValue("user-account-123");
      mockValidateOrganizationAccess.mockResolvedValue(false);

      const request = createMockRequest(
        { prompt: "Hello", organizationId: "org-not-member" },
        { authorization: "Bearer valid-jwt-token" },
      );

      const result = await validateChatAuth(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Access denied to specified organizationId");
    });

    it("uses API key orgId when no organizationId is provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("org-account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "org-account-123",
        orgId: "api-key-org-123",
      });

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "org-api-key" });

      const result = await validateChatAuth(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).orgId).toBe("api-key-org-123");
      expect(mockValidateOrganizationAccess).not.toHaveBeenCalled();
    });
  });
});
