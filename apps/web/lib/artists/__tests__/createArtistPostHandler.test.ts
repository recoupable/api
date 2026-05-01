import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { createArtistPostHandler } from "../createArtistPostHandler";

const mockCreateArtistInDb = vi.fn();
const mockValidateAuthContext = vi.fn();

vi.mock("@/lib/artists/createArtistInDb", () => ({
  createArtistInDb: (...args: unknown[]) => mockCreateArtistInDb(...args),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

function createRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": "test-api-key",
  };
  return new NextRequest("http://localhost/api/artists", {
    method: "POST",
    headers: { ...defaultHeaders, ...headers },
    body: JSON.stringify(body),
  });
}

describe("createArtistPostHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: successful auth with personal API key
    mockValidateAuthContext.mockResolvedValue({
      accountId: "api-key-account-id",
      orgId: null,
      authToken: "test-api-key",
    });
  });

  it("creates artist using account_id from auth context", async () => {
    const mockArtist = {
      id: "artist-123",
      account_id: "artist-123",
      name: "Test Artist",
      account_info: [{ image: null }],
      account_socials: [],
    };
    mockCreateArtistInDb.mockResolvedValue(mockArtist);

    const request = createRequest({ name: "Test Artist" });
    const response = await createArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.artist).toEqual(mockArtist);
    expect(mockCreateArtistInDb).toHaveBeenCalledWith(
      "Test Artist",
      "api-key-account-id",
      undefined,
    );
  });

  it("uses account_id override for org API keys", async () => {
    mockValidateAuthContext.mockResolvedValue({
      accountId: "550e8400-e29b-41d4-a716-446655440000", // Overridden account
      orgId: "org-account-id",
      authToken: "test-api-key",
    });

    const mockArtist = {
      id: "artist-123",
      account_id: "artist-123",
      name: "Test Artist",
      account_info: [{ image: null }],
      account_socials: [],
    };
    mockCreateArtistInDb.mockResolvedValue(mockArtist);

    const request = createRequest({
      name: "Test Artist",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    const response = await createArtistPostHandler(request);

    expect(mockCreateArtistInDb).toHaveBeenCalledWith(
      "Test Artist",
      "550e8400-e29b-41d4-a716-446655440000",
      undefined,
    );
    expect(response.status).toBe(201);
  });

  it("returns 403 when org API key lacks access to account_id", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Access denied to specified account_id" },
        { status: 403 },
      ),
    );

    const request = createRequest({
      name: "Test Artist",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    const response = await createArtistPostHandler(request);

    expect(response.status).toBe(403);
  });

  it("passes organization_id to createArtistInDb", async () => {
    const mockArtist = {
      id: "artist-123",
      account_id: "artist-123",
      name: "Test Artist",
      account_info: [{ image: null }],
      account_socials: [],
    };
    mockCreateArtistInDb.mockResolvedValue(mockArtist);

    const request = createRequest({
      name: "Test Artist",
      organization_id: "660e8400-e29b-41d4-a716-446655440001",
    });

    await createArtistPostHandler(request);

    expect(mockCreateArtistInDb).toHaveBeenCalledWith(
      "Test Artist",
      "api-key-account-id",
      "660e8400-e29b-41d4-a716-446655440001",
    );
  });

  it("returns 401 when auth is missing", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );

    const request = new NextRequest("http://localhost/api/artists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Artist" }),
    });

    const response = await createArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Exactly one of x-api-key or Authorization must be provided");
  });

  it("returns 400 when name is missing", async () => {
    const request = createRequest({});
    const response = await createArtistPostHandler(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid JSON body (treated as empty)", async () => {
    const request = new NextRequest("http://localhost/api/artists", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-api-key",
      },
      body: "invalid json",
    });

    const response = await createArtistPostHandler(request);
    const data = await response.json();

    // safeParseJson returns {} for invalid JSON, so schema validation catches it
    expect(response.status).toBe(400);
    expect(data.error).toBe("name is required");
  });

  it("returns 500 when artist creation fails", async () => {
    mockCreateArtistInDb.mockResolvedValue(null);

    const request = createRequest({ name: "Test Artist" });
    const response = await createArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create artist");
  });

  it("returns 500 with error message when exception thrown", async () => {
    mockCreateArtistInDb.mockRejectedValue(new Error("Database error"));

    const request = createRequest({ name: "Test Artist" });
    const response = await createArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
  });
});
