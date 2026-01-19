import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetApiKeyDetails = vi.fn();
const mockCanAccessAccount = vi.fn();

vi.mock("@/lib/keys/getApiKeyDetails", () => ({
  getApiKeyDetails: (...args: unknown[]) => mockGetApiKeyDetails(...args),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: (...args: unknown[]) => mockCanAccessAccount(...args),
}));

import { validateCreateArtistBody } from "../validateCreateArtistBody";

function createRequest(body: unknown, apiKey?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  return new NextRequest("http://localhost/api/artists", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("validateCreateArtistBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiKeyDetails.mockResolvedValue({
      accountId: "api-key-account-id",
      orgId: null,
    });
  });

  it("returns validated data with accountId from API key", async () => {
    const request = createRequest({ name: "Test Artist" }, "test-api-key");
    const result = await validateCreateArtistBody(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.name).toBe("Test Artist");
      expect(result.accountId).toBe("api-key-account-id");
      expect(result.organizationId).toBeUndefined();
    }
  });

  it("returns validated data with organization_id", async () => {
    const request = createRequest(
      { name: "Test Artist", organization_id: "660e8400-e29b-41d4-a716-446655440001" },
      "test-api-key",
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
    mockGetApiKeyDetails.mockResolvedValue({
      accountId: "org-account-id",
      orgId: "org-account-id",
    });
    mockCanAccessAccount.mockResolvedValue(true);

    const request = createRequest(
      { name: "Test Artist", account_id: "550e8400-e29b-41d4-a716-446655440000" },
      "test-api-key",
    );
    const result = await validateCreateArtistBody(request);

    expect(mockCanAccessAccount).toHaveBeenCalledWith({
      orgId: "org-account-id",
      targetAccountId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.accountId).toBe("550e8400-e29b-41d4-a716-446655440000");
    }
  });

  it("returns 403 when org API key lacks access to account_id", async () => {
    mockGetApiKeyDetails.mockResolvedValue({
      accountId: "org-account-id",
      orgId: "org-account-id",
    });
    mockCanAccessAccount.mockResolvedValue(false);

    const request = createRequest(
      { name: "Test Artist", account_id: "550e8400-e29b-41d4-a716-446655440000" },
      "test-api-key",
    );
    const result = await validateCreateArtistBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(403);
      const data = await result.json();
      expect(data.error).toBe("Access denied to specified account_id");
    }
  });

  it("returns 401 when API key is missing", async () => {
    const request = createRequest({ name: "Test Artist" });
    const result = await validateCreateArtistBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401);
      const data = await result.json();
      expect(data.error).toBe("x-api-key header required");
    }
  });

  it("returns 401 when API key is invalid", async () => {
    mockGetApiKeyDetails.mockResolvedValue(null);

    const request = createRequest({ name: "Test Artist" }, "invalid-key");
    const result = await validateCreateArtistBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401);
      const data = await result.json();
      expect(data.error).toBe("Invalid API key");
    }
  });

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
    const request = createRequest({}, "test-api-key");
    const result = await validateCreateArtistBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });

  it("returns error when name is empty", async () => {
    const request = createRequest({ name: "" }, "test-api-key");
    const result = await validateCreateArtistBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });

  it("returns error when account_id is not a valid UUID", async () => {
    const request = createRequest(
      { name: "Test Artist", account_id: "invalid-uuid" },
      "test-api-key",
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
      "test-api-key",
    );
    const result = await validateCreateArtistBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });
});
