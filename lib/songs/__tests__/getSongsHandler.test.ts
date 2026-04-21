import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getSongsHandler } from "../getSongsHandler";

const mockValidateAuthContext = vi.fn();
const mockSelectSongsWithArtists = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/supabase/songs/selectSongsWithArtists", () => ({
  selectSongsWithArtists: (...args: unknown[]) => mockSelectSongsWithArtists(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function makeAuthedRequest(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { authorization: "Bearer test-token" },
  });
}

describe("getSongsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "auth-account",
      orgId: null,
      authToken: "test-token",
    });
    mockSelectSongsWithArtists.mockResolvedValue([]);
  });

  it("returns 200 with the songs envelope and CORS headers on success", async () => {
    mockSelectSongsWithArtists.mockResolvedValue([
      {
        isrc: "USRC17607839",
        name: "Song",
        album: null,
        notes: null,
        updated_at: "t",
        artists: [],
      },
    ]);

    const req = makeAuthedRequest("https://example.com/api/songs?isrc=USRC17607839");
    const response = await getSongsHandler(req);

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.songs).toHaveLength(1);
    expect(mockSelectSongsWithArtists).toHaveBeenCalledWith({ isrc: "USRC17607839" });
  });

  it("passes artist_account_id through snake_case with no remap", async () => {
    const req = makeAuthedRequest(`https://example.com/api/songs?artist_account_id=${VALID_UUID}`);
    const response = await getSongsHandler(req);

    expect(response.status).toBe(200);
    expect(mockSelectSongsWithArtists).toHaveBeenCalledWith({ artist_account_id: VALID_UUID });
  });

  it("returns 200 with no filters (full list)", async () => {
    const req = makeAuthedRequest("https://example.com/api/songs");
    const response = await getSongsHandler(req);

    expect(response.status).toBe(200);
    expect(mockSelectSongsWithArtists).toHaveBeenCalledWith({});
  });

  it("returns 401 when auth fails", async () => {
    mockValidateAuthContext.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "unauthorized" }, { status: 401 }),
    );

    const req = new NextRequest("https://example.com/api/songs");
    const response = await getSongsHandler(req);

    expect(response.status).toBe(401);
    expect(mockSelectSongsWithArtists).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid artist_account_id", async () => {
    const req = makeAuthedRequest("https://example.com/api/songs?artist_account_id=not-a-uuid");
    const response = await getSongsHandler(req);

    expect(response.status).toBe(400);
    expect(mockSelectSongsWithArtists).not.toHaveBeenCalled();
  });

  it("returns 500 with a generic error string (never the raw error message)", async () => {
    mockSelectSongsWithArtists.mockRejectedValue(
      new Error("db down: connection refused at 10.0.0.1:5432"),
    );

    const req = makeAuthedRequest("https://example.com/api/songs?isrc=USRC17607839");
    const response = await getSongsHandler(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.status).toBe("error");
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("db down");
    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
  });
});
