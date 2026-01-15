import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCreateArtistInDb = vi.fn();
const mockValidateCreateArtistBody = vi.fn();

vi.mock("@/lib/artists/createArtistInDb", () => ({
  createArtistInDb: (...args: unknown[]) => mockCreateArtistInDb(...args),
}));

vi.mock("@/lib/artists/validateCreateArtistBody", () => ({
  validateCreateArtistBody: (...args: unknown[]) =>
    mockValidateCreateArtistBody(...args),
}));

import { createArtistPostHandler } from "../createArtistPostHandler";

describe("createArtistPostHandler", () => {
  const mockArtist = {
    id: "artist-123",
    account_id: "artist-123",
    name: "Test Artist",
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    image: null,
    instruction: null,
    knowledges: null,
    label: null,
    organization: null,
    company_name: null,
    job_title: null,
    role_type: null,
    onboarding_status: null,
    onboarding_data: null,
    account_info: [],
    account_socials: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 with artist data on successful creation", async () => {
    const validatedBody = {
      name: "Test Artist",
      account_id: "owner-456",
    };
    mockValidateCreateArtistBody.mockReturnValue(validatedBody);
    mockCreateArtistInDb.mockResolvedValue(mockArtist);

    const request = new NextRequest("http://localhost/api/artist", {
      method: "POST",
      body: JSON.stringify(validatedBody),
      headers: { "Content-Type": "application/json" },
    });

    const response = await createArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.artist).toEqual(mockArtist);
    expect(mockCreateArtistInDb).toHaveBeenCalledWith("Test Artist", "owner-456");
  });

  it("parses JSON body from request", async () => {
    const validatedBody = {
      name: "Test Artist",
      account_id: "owner-456",
    };
    mockValidateCreateArtistBody.mockReturnValue(validatedBody);
    mockCreateArtistInDb.mockResolvedValue(mockArtist);

    const request = new NextRequest("http://localhost/api/artist", {
      method: "POST",
      body: JSON.stringify(validatedBody),
      headers: { "Content-Type": "application/json" },
    });

    await createArtistPostHandler(request);

    expect(mockValidateCreateArtistBody).toHaveBeenCalledWith(validatedBody);
  });

  it("returns validation error response when validation fails", async () => {
    const { NextResponse } = await import("next/server");
    const errorResponse = NextResponse.json(
      { status: "error", error: "name is required" },
      { status: 400 },
    );
    mockValidateCreateArtistBody.mockReturnValue(errorResponse);

    const request = new NextRequest("http://localhost/api/artist", {
      method: "POST",
      body: JSON.stringify({ account_id: "owner-456" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await createArtistPostHandler(request);

    expect(response.status).toBe(400);
    expect(mockCreateArtistInDb).not.toHaveBeenCalled();
  });

  it("returns 500 when createArtistInDb returns null", async () => {
    const validatedBody = {
      name: "Test Artist",
      account_id: "owner-456",
    };
    mockValidateCreateArtistBody.mockReturnValue(validatedBody);
    mockCreateArtistInDb.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/artist", {
      method: "POST",
      body: JSON.stringify(validatedBody),
      headers: { "Content-Type": "application/json" },
    });

    const response = await createArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe("Failed to create artist");
  });

  it("returns 400 with error message when createArtistInDb throws", async () => {
    const validatedBody = {
      name: "Test Artist",
      account_id: "owner-456",
    };
    mockValidateCreateArtistBody.mockReturnValue(validatedBody);
    mockCreateArtistInDb.mockRejectedValue(new Error("Database error"));

    const request = new NextRequest("http://localhost/api/artist", {
      method: "POST",
      body: JSON.stringify(validatedBody),
      headers: { "Content-Type": "application/json" },
    });

    const response = await createArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Database error");
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const request = new NextRequest("http://localhost/api/artist", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });

    const response = await createArtistPostHandler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Invalid JSON body");
  });

  it("includes CORS headers in successful response", async () => {
    const validatedBody = {
      name: "Test Artist",
      account_id: "owner-456",
    };
    mockValidateCreateArtistBody.mockReturnValue(validatedBody);
    mockCreateArtistInDb.mockResolvedValue(mockArtist);

    const request = new NextRequest("http://localhost/api/artist", {
      method: "POST",
      body: JSON.stringify(validatedBody),
      headers: { "Content-Type": "application/json" },
    });

    const response = await createArtistPostHandler(request);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes CORS headers in error response", async () => {
    const validatedBody = {
      name: "Test Artist",
      account_id: "owner-456",
    };
    mockValidateCreateArtistBody.mockReturnValue(validatedBody);
    mockCreateArtistInDb.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/artist", {
      method: "POST",
      body: JSON.stringify(validatedBody),
      headers: { "Content-Type": "application/json" },
    });

    const response = await createArtistPostHandler(request);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
