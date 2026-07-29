import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { createArtistPostHandler } from "../createArtistPostHandler";

const mockResolveOrCreateArtist = vi.fn();
const mockValidateAuthContext = vi.fn();

vi.mock("@/lib/artists/resolveOrCreateArtist", () => ({
  resolveOrCreateArtist: (...args: unknown[]) => mockResolveOrCreateArtist(...args),
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
    mockResolveOrCreateArtist.mockResolvedValue({ artist: mockArtist, created: true });

    const request = createRequest({ name: "Test Artist" });
    const response = await createArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.artist).toEqual(mockArtist);
    expect(mockResolveOrCreateArtist).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test Artist", accountId: "api-key-account-id" }),
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
    mockResolveOrCreateArtist.mockResolvedValue({ artist: mockArtist, created: true });

    const request = createRequest({
      name: "Test Artist",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    const response = await createArtistPostHandler(request);

    expect(mockResolveOrCreateArtist).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test Artist",
        accountId: "550e8400-e29b-41d4-a716-446655440000",
      }),
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
    mockResolveOrCreateArtist.mockResolvedValue({ artist: mockArtist, created: true });

    const request = createRequest({
      name: "Test Artist",
      organization_id: "660e8400-e29b-41d4-a716-446655440001",
    });

    await createArtistPostHandler(request);

    expect(mockResolveOrCreateArtist).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test Artist", accountId: "api-key-account-id" }),
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
    mockResolveOrCreateArtist.mockResolvedValue({ artist: null, created: true });

    const request = createRequest({ name: "Test Artist" });
    const response = await createArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create artist");
  });

  it("returns 500 with error message when exception thrown", async () => {
    mockResolveOrCreateArtist.mockRejectedValue(new Error("Database error"));

    const request = createRequest({ name: "Test Artist" });
    const response = await createArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
  });
  // Row 8 (chat#1889): 200 = existing canonical linked, 201 = created.
  it("returns 200 when an existing canonical was linked instead of created", async () => {
    mockResolveOrCreateArtist.mockResolvedValue({
      artist: { id: "canonical-1", account_id: "canonical-1", name: "Del Water Gap" },
      created: false,
    });
    const response = await createArtistPostHandler(
      createRequest({ name: "Del Water Gap", spotify_artist_id: "0xPoVNPnxIIUS1vrxAYV00" }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.artist.account_id).toBe("canonical-1");
  });

  it("passes the spotify id through to resolveOrCreateArtist", async () => {
    mockResolveOrCreateArtist.mockResolvedValue({
      artist: { id: "new-1", account_id: "new-1", name: "X" },
      created: true,
    });
    await createArtistPostHandler(
      createRequest({ name: "X", spotify_artist_id: "0xPoVNPnxIIUS1vrxAYV00" }),
    );

    expect(mockResolveOrCreateArtist).toHaveBeenCalledWith(
      expect.objectContaining({ spotifyArtistId: "0xPoVNPnxIIUS1vrxAYV00" }),
    );
  });
});
