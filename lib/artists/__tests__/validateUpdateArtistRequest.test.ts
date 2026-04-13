import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateUpdateArtistRequest } from "../validateUpdateArtistRequest";

const mockValidateAuthContext = vi.fn();
const mockSelectAccounts = vi.fn();
const mockCheckAccountArtistAccess = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: (...args: unknown[]) => mockSelectAccounts(...args),
}));

vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: (...args: unknown[]) => mockCheckAccountArtistAccess(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(async (req: Request) => req.json()),
}));

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/artists/550e8400-e29b-41d4-a716-446655440000", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: JSON.stringify(body),
  });
}

describe("validateUpdateArtistRequest", () => {
  const artistId = "550e8400-e29b-41d4-a716-446655440000";
  const requesterAccountId = "660e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: requesterAccountId,
      orgId: null,
      authToken: "test-token",
    });
    mockSelectAccounts.mockResolvedValue([{ id: artistId }]);
    mockCheckAccountArtistAccess.mockResolvedValue(true);
  });

  it("returns the validated artist update payload for a valid request", async () => {
    const request = createRequest({
      name: "Updated Artist",
      image: "https://example.com/artist.jpg",
      instruction: "Focus on fan growth",
      label: "Recoup Records",
      knowledges: [
        {
          name: "Press Kit",
          url: "https://example.com/press-kit.pdf",
          type: "application/pdf",
        },
      ],
      profileUrls: {
        INSTAGRAM: "https://instagram.com/updated_artist",
      },
    });

    const result = await validateUpdateArtistRequest(request, artistId);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result).toEqual({
        artistId,
        requesterAccountId,
        name: "Updated Artist",
        image: "https://example.com/artist.jpg",
        instruction: "Focus on fan growth",
        label: "Recoup Records",
        knowledges: [
          {
            name: "Press Kit",
            url: "https://example.com/press-kit.pdf",
            type: "application/pdf",
          },
        ],
        profileUrls: {
          INSTAGRAM: "https://instagram.com/updated_artist",
        },
      });
    }
  });

  it("returns 400 when no fields are provided", async () => {
    const request = createRequest({});

    const result = await validateUpdateArtistRequest(request, artistId);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });

  it("returns 400 when the artist id is invalid", async () => {
    const request = createRequest({
      name: "Updated Artist",
    });

    const result = await validateUpdateArtistRequest(request, "not-a-uuid");

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });

  it("returns 401 when auth fails", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = createRequest({
      name: "Updated Artist",
    });

    const result = await validateUpdateArtistRequest(request, artistId);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401);
    }
  });

  it("returns 404 when the artist does not exist", async () => {
    mockSelectAccounts.mockResolvedValue([]);

    const request = createRequest({
      name: "Updated Artist",
    });

    const result = await validateUpdateArtistRequest(request, artistId);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(404);
    }
  });

  it("returns 403 when the requester cannot access the artist", async () => {
    mockCheckAccountArtistAccess.mockResolvedValue(false);

    const request = createRequest({
      name: "Updated Artist",
    });

    const result = await validateUpdateArtistRequest(request, artistId);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(403);
    }
  });
});
