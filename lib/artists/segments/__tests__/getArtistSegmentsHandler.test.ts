import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getArtistSegmentsHandler } from "../getArtistSegmentsHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getArtistSegments } from "../getArtistSegments";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("../getArtistSegments", () => ({
  getArtistSegments: vi.fn(),
}));

describe("getArtistSegmentsHandler", () => {
  const artistId = "550e8400-e29b-41d4-a716-446655440000";
  const requesterAccountId = "660e8400-e29b-41d4-a716-446655440000";

  const buildRequest = (url = `http://localhost/api/artists/${artistId}/segments`) =>
    new NextRequest(url, {
      method: "GET",
      headers: { Authorization: "Bearer test-token" },
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when the path id is not a valid UUID", async () => {
    const response = await getArtistSegmentsHandler(
      buildRequest("http://localhost/api/artists/not-a-uuid/segments"),
      Promise.resolve({ id: "not-a-uuid" }),
    );

    expect(response.status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
    expect(getArtistSegments).not.toHaveBeenCalled();
  });

  it("returns the auth error when authentication fails", async () => {
    const authError = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authError);

    const response = await getArtistSegmentsHandler(
      buildRequest(),
      Promise.resolve({ id: artistId }),
    );

    expect(response).toBe(authError);
    expect(getArtistSegments).not.toHaveBeenCalled();
  });

  it("returns 400 when query params are invalid", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: requesterAccountId,
      authToken: "test-token",
      orgId: null,
    });

    const response = await getArtistSegmentsHandler(
      buildRequest(`http://localhost/api/artists/${artistId}/segments?limit=500`),
      Promise.resolve({ id: artistId }),
    );

    expect(response.status).toBe(400);
    expect(getArtistSegments).not.toHaveBeenCalled();
  });

  it("returns 200 with the segments payload when successful", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: requesterAccountId,
      authToken: "test-token",
      orgId: null,
    });
    vi.mocked(getArtistSegments).mockResolvedValue({
      status: "success",
      segments: [],
      pagination: { total_count: 0, page: 1, limit: 20, total_pages: 0 },
    });

    const response = await getArtistSegmentsHandler(
      buildRequest(),
      Promise.resolve({ id: artistId }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getArtistSegments).toHaveBeenCalledWith(artistId, {
      page: 1,
      limit: 20,
    });
    expect(body.status).toBe("success");
    expect(body.segments).toEqual([]);
  });

  it("passes the path id through even when the query contains artist_account_id", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: requesterAccountId,
      authToken: "test-token",
      orgId: null,
    });
    vi.mocked(getArtistSegments).mockResolvedValue({
      status: "success",
      segments: [],
      pagination: { total_count: 0, page: 2, limit: 5, total_pages: 0 },
    });

    const response = await getArtistSegmentsHandler(
      buildRequest(
        `http://localhost/api/artists/${artistId}/segments?artist_account_id=someone-else&page=2&limit=5`,
      ),
      Promise.resolve({ id: artistId }),
    );

    expect(response.status).toBe(200);
    expect(getArtistSegments).toHaveBeenCalledWith(artistId, {
      page: 2,
      limit: 5,
    });
  });

  it("returns 500 when getArtistSegments reports an error status", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: requesterAccountId,
      authToken: "test-token",
      orgId: null,
    });
    vi.mocked(getArtistSegments).mockResolvedValue({
      status: "error",
      segments: [],
      pagination: { total_count: 0, page: 1, limit: 20, total_pages: 0 },
    });

    const response = await getArtistSegmentsHandler(
      buildRequest(),
      Promise.resolve({ id: artistId }),
    );

    expect(response.status).toBe(500);
  });

  it("returns 500 when getArtistSegments throws", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: requesterAccountId,
      authToken: "test-token",
      orgId: null,
    });
    vi.mocked(getArtistSegments).mockRejectedValue(new Error("boom"));

    const response = await getArtistSegmentsHandler(
      buildRequest(),
      Promise.resolve({ id: artistId }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.status).toBe("error");
    expect(body.message).toBe("boom");
  });
});
