import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { postArtistSegmentsHandler } from "../postArtistSegmentsHandler";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const mockValidateAuthContext = vi.fn();
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

const mockSelectAccounts = vi.fn();
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: (...args: unknown[]) => mockSelectAccounts(...args),
}));

const mockCheckAccountArtistAccess = vi.fn();
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: (...args: unknown[]) => mockCheckAccountArtistAccess(...args),
}));

const mockCreateSegments = vi.fn();
vi.mock("@/lib/segments/createSegments", () => ({
  createSegments: (...args: unknown[]) => mockCreateSegments(...args),
}));

const ARTIST_ID = "550e8400-e29b-41d4-a716-446655440000";
const REQUESTER_ACCOUNT_ID = "660e8400-e29b-41d4-a716-446655440000";

function createRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": "test-api-key",
  };
  return new NextRequest(`http://localhost/api/artists/${ARTIST_ID}/segments`, {
    method: "POST",
    headers: { ...defaultHeaders, ...headers },
    body: JSON.stringify(body),
  });
}

describe("postArtistSegmentsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: REQUESTER_ACCOUNT_ID,
      orgId: null,
      authToken: "test-api-key",
    });
    mockSelectAccounts.mockResolvedValue([{ id: ARTIST_ID, name: "Test Artist" }]);
    mockCheckAccountArtistAccess.mockResolvedValue(true);
  });

  it("returns 200 with success envelope when segments are created", async () => {
    mockCreateSegments.mockResolvedValue({
      success: true,
      status: "success",
      message: "Successfully created 5 segments for artist",
      data: {
        supabase_segments: [],
        supabase_artist_segments: [],
        supabase_fan_segments: [],
        segments: [],
      },
      count: 5,
    });

    const request = createRequest({ prompt: "Segment my fans" });
    const response = await postArtistSegmentsHandler(request, Promise.resolve({ id: ARTIST_ID }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      segments_created: 5,
      message: "Segments generated successfully.",
    });
    expect(mockCreateSegments).toHaveBeenCalledWith({
      artist_account_id: ARTIST_ID,
      prompt: "Segment my fans",
    });
  });

  it("returns 400 when prompt is missing", async () => {
    const request = createRequest({});
    const response = await postArtistSegmentsHandler(request, Promise.resolve({ id: ARTIST_ID }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.status).toBe("error");
    expect(body.error).toBe("prompt is required");
    expect(mockCreateSegments).not.toHaveBeenCalled();
  });

  it("returns 400 when prompt is empty", async () => {
    const request = createRequest({ prompt: "" });
    const response = await postArtistSegmentsHandler(request, Promise.resolve({ id: ARTIST_ID }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("prompt cannot be empty");
    expect(mockCreateSegments).not.toHaveBeenCalled();
  });

  it("returns 400 when path id is not a valid UUID", async () => {
    const request = createRequest({ prompt: "Segment my fans" });
    const response = await postArtistSegmentsHandler(
      request,
      Promise.resolve({ id: "not-a-uuid" }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.status).toBe("error");
    expect(mockCreateSegments).not.toHaveBeenCalled();
  });

  it("returns 401 when auth context fails", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );

    const request = new NextRequest(`http://localhost/api/artists/${ARTIST_ID}/segments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Segment my fans" }),
    });

    const response = await postArtistSegmentsHandler(request, Promise.resolve({ id: ARTIST_ID }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Exactly one of x-api-key or Authorization must be provided");
    expect(mockCreateSegments).not.toHaveBeenCalled();
  });

  it("returns 403 when caller lacks access to artist", async () => {
    mockCheckAccountArtistAccess.mockResolvedValue(false);

    const request = createRequest({ prompt: "Segment my fans" });
    const response = await postArtistSegmentsHandler(request, Promise.resolve({ id: ARTIST_ID }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.status).toBe("error");
    expect(body.error).toBe("Unauthorized segment creation attempt");
    expect(mockCreateSegments).not.toHaveBeenCalled();
  });

  it("returns 404 when artist does not exist", async () => {
    mockSelectAccounts.mockResolvedValue([]);

    const request = createRequest({ prompt: "Segment my fans" });
    const response = await postArtistSegmentsHandler(request, Promise.resolve({ id: ARTIST_ID }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Artist not found");
    expect(mockCheckAccountArtistAccess).not.toHaveBeenCalled();
    expect(mockCreateSegments).not.toHaveBeenCalled();
  });

  it("returns 409 when createSegments reports no social account with feedback", async () => {
    const feedback = "No Instagram accounts found for Test Artist. Follow these steps...";
    mockCreateSegments.mockResolvedValue({
      success: false,
      status: "error",
      message: "No social account found for this artist",
      data: [],
      count: 0,
      feedback,
    });

    const request = createRequest({ prompt: "Segment my fans" });
    const response = await postArtistSegmentsHandler(request, Promise.resolve({ id: ARTIST_ID }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      status: "error",
      error: "No social account found for this artist",
      feedback,
    });
  });

  it("returns 409 when createSegments reports no fans with feedback", async () => {
    const feedback = "No social_fans records found for Test Artist. Follow these steps...";
    mockCreateSegments.mockResolvedValue({
      success: false,
      status: "error",
      message: "No fans found for this artist",
      data: [],
      count: 0,
      feedback,
    });

    const request = createRequest({ prompt: "Segment my fans" });
    const response = await postArtistSegmentsHandler(request, Promise.resolve({ id: ARTIST_ID }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      status: "error",
      error: "No fans found for this artist",
      feedback,
    });
  });

  it("returns 500 when createSegments reports a generic failure", async () => {
    mockCreateSegments.mockResolvedValue({
      success: false,
      status: "error",
      message: "Failed to generate segment names",
      data: [],
      count: 0,
    });

    const request = createRequest({ prompt: "Segment my fans" });
    const response = await postArtistSegmentsHandler(request, Promise.resolve({ id: ARTIST_ID }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Failed to generate segment names",
    });
  });

  it("returns 500 when createSegments throws", async () => {
    mockCreateSegments.mockRejectedValue(new Error("Database exploded"));

    const request = createRequest({ prompt: "Segment my fans" });
    const response = await postArtistSegmentsHandler(request, Promise.resolve({ id: ARTIST_ID }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Database exploded");
  });
});
