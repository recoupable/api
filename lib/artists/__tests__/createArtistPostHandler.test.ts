import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCreateArtistInDb = vi.fn();
const mockGetApiKeyDetails = vi.fn();
const mockCanAccessAccount = vi.fn();

vi.mock("@/lib/artists/createArtistInDb", () => ({
  createArtistInDb: (...args: unknown[]) => mockCreateArtistInDb(...args),
}));

vi.mock("@/lib/keys/getApiKeyDetails", () => ({
  getApiKeyDetails: (...args: unknown[]) => mockGetApiKeyDetails(...args),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: (...args: unknown[]) => mockCanAccessAccount(...args),
}));

import { createArtistPostHandler } from "../createArtistPostHandler";

function createRequest(body: unknown, apiKey = "test-api-key"): NextRequest {
  return new NextRequest("http://localhost/api/artists", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
}

describe("createArtistPostHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiKeyDetails.mockResolvedValue({
      accountId: "api-key-account-id",
      orgId: null,
    });
  });

  it("creates artist using account_id from API key", async () => {
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
    mockGetApiKeyDetails.mockResolvedValue({
      accountId: "org-account-id",
      orgId: "org-account-id",
    });
    mockCanAccessAccount.mockResolvedValue(true);

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

    expect(mockCanAccessAccount).toHaveBeenCalledWith({
      orgId: "org-account-id",
      targetAccountId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(mockCreateArtistInDb).toHaveBeenCalledWith(
      "Test Artist",
      "550e8400-e29b-41d4-a716-446655440000",
      undefined,
    );
    expect(response.status).toBe(201);
  });

  it("returns 403 when org API key lacks access to account_id", async () => {
    mockGetApiKeyDetails.mockResolvedValue({
      accountId: "org-account-id",
      orgId: "org-account-id",
    });
    mockCanAccessAccount.mockResolvedValue(false);

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

  it("returns 401 when API key is missing", async () => {
    const request = new NextRequest("http://localhost/api/artists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Artist" }),
    });

    const response = await createArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("x-api-key header required");
  });

  it("returns 401 when API key is invalid", async () => {
    mockGetApiKeyDetails.mockResolvedValue(null);

    const request = createRequest({ name: "Test Artist" });
    const response = await createArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid API key");
  });

  it("returns 400 when name is missing", async () => {
    const request = createRequest({});
    const response = await createArtistPostHandler(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
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

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
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
