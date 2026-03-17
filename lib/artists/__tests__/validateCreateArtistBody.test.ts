import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateCreateArtistBody } from "../validateCreateArtistBody";

const mockValidateAuthContext = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

function createRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const defaultHeaders: Record<string, string> = { "Content-Type": "application/json" };
  return new NextRequest("http://localhost/api/artists", {
    method: "POST",
    headers: { ...defaultHeaders, ...headers },
    body: JSON.stringify(body),
  });
}

describe("validateCreateArtistBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: successful auth with personal API key
    mockValidateAuthContext.mockResolvedValue({
      accountId: "api-key-account-id",
      orgId: null,
      authToken: "test-api-key",
    });
  });

  describe("successful validation", () => {
    it("returns validated data with accountId from auth context", async () => {
      const request = createRequest({ name: "Test Artist" }, { "x-api-key": "test-api-key" });
      const result = await validateCreateArtistBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.name).toBe("Test Artist");
        expect(result.accountId).toBe("api-key-account-id");
        expect(result.organizationId).toBeUndefined();
      }
    });

    it("returns validated data with organization_id", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "api-key-account-id",
        orgId: "660e8400-e29b-41d4-a716-446655440001",
        authToken: "test-api-key",
      });

      const request = createRequest(
        { name: "Test Artist", organization_id: "660e8400-e29b-41d4-a716-446655440001" },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateCreateArtistBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.name).toBe("Test Artist");
        expect(result.accountId).toBe("api-key-account-id");
        expect(result.organizationId).toBe("660e8400-e29b-41d4-a716-446655440001");
      }
    });

    it("uses account_id override for org API keys with access", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "550e8400-e29b-41d4-a716-446655440000", // Overridden account
        orgId: "org-account-id",
        authToken: "test-api-key",
      });

      const request = createRequest(
        { name: "Test Artist", account_id: "550e8400-e29b-41d4-a716-446655440000" },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateCreateArtistBody(request);

      // Verify validateAuthContext was called with account_id override
      expect(mockValidateAuthContext).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          accountId: "550e8400-e29b-41d4-a716-446655440000",
        }),
      );

      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.accountId).toBe("550e8400-e29b-41d4-a716-446655440000");
      }
    });
  });

  describe("auth errors", () => {
    it("returns 401 when auth is missing", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
          { status: 401 },
        ),
      );

      const request = createRequest({ name: "Test Artist" });
      const result = await validateCreateArtistBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(401);
      }
    });

    it("returns 403 when org API key lacks access to account_id", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Access denied to specified account_id" },
          { status: 403 },
        ),
      );

      const request = createRequest(
        { name: "Test Artist", account_id: "550e8400-e29b-41d4-a716-446655440000" },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateCreateArtistBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403);
        const data = await result.json();
        expect(data.error).toBe("Access denied to specified account_id");
      }
    });

    it("returns 403 when account lacks access to organization_id", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Access denied to specified organization_id" },
          { status: 403 },
        ),
      );

      const request = createRequest(
        { name: "Test Artist", organization_id: "660e8400-e29b-41d4-a716-446655440001" },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateCreateArtistBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403);
        const data = await result.json();
        expect(data.error).toBe("Access denied to specified organization_id");
      }
    });
  });

  describe("schema validation errors", () => {
    it("returns schema error for invalid JSON body (treated as empty)", async () => {
      const request = new NextRequest("http://localhost/api/artists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "test-api-key",
        },
        body: "invalid json",
      });

      const result = await validateCreateArtistBody(request);

      // safeParseJson returns {} for invalid JSON, so schema validation catches it
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const data = await result.json();
        expect(data.error).toBe("name is required");
      }
    });

    it("returns error when name is missing", async () => {
      const request = createRequest({}, { "x-api-key": "test-api-key" });
      const result = await validateCreateArtistBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns error when name is empty", async () => {
      const request = createRequest({ name: "" }, { "x-api-key": "test-api-key" });
      const result = await validateCreateArtistBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns error when account_id is not a valid UUID", async () => {
      const request = createRequest(
        { name: "Test Artist", account_id: "invalid-uuid" },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateCreateArtistBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns error when organization_id is not a valid UUID", async () => {
      const request = createRequest(
        { name: "Test Artist", organization_id: "invalid-uuid" },
        { "x-api-key": "test-api-key" },
      );
      const result = await validateCreateArtistBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });
  });

  describe("auth context input", () => {
    it("passes account_id and organization_id to validateAuthContext", async () => {
      const request = createRequest(
        {
          name: "Test Artist",
          account_id: "550e8400-e29b-41d4-a716-446655440000",
          organization_id: "660e8400-e29b-41d4-a716-446655440001",
        },
        { "x-api-key": "test-api-key" },
      );

      await validateCreateArtistBody(request);

      expect(mockValidateAuthContext).toHaveBeenCalledWith(expect.anything(), {
        accountId: "550e8400-e29b-41d4-a716-446655440000",
        organizationId: "660e8400-e29b-41d4-a716-446655440001",
      });
    });

    it("passes undefined for missing account_id and organization_id", async () => {
      const request = createRequest({ name: "Test Artist" }, { "x-api-key": "test-api-key" });

      await validateCreateArtistBody(request);

      expect(mockValidateAuthContext).toHaveBeenCalledWith(expect.anything(), {
        accountId: undefined,
        organizationId: undefined,
      });
    });
  });
});
