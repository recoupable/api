import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateDeleteArtistRequest } from "../validateDeleteArtistRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateDeleteArtistRequest", () => {
  const validArtistId = "550e8400-e29b-41d4-a716-446655440000";
  const authenticatedAccountId = "660e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a 400 response when the artist id is invalid", async () => {
    const request = new NextRequest("http://localhost/api/artists/not-a-uuid", {
      method: "DELETE",
      headers: {
        Authorization: "Bearer test-token",
      },
    });

    const result = await validateDeleteArtistRequest(request, "not-a-uuid");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns the auth error when authentication fails", async () => {
    const authError = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authError);

    const request = new NextRequest(`http://localhost/api/artists/${validArtistId}`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer test-token",
      },
    });

    const result = await validateDeleteArtistRequest(request, validArtistId);

    expect(result).toBe(authError);
    expect(validateAuthContext).toHaveBeenCalledWith(request);
  });

  it("returns the validated artist and requester account ids", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: authenticatedAccountId,
      authToken: "test-token",
      orgId: null,
    });

    const request = new NextRequest(`http://localhost/api/artists/${validArtistId}`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer test-token",
      },
    });

    const result = await validateDeleteArtistRequest(request, validArtistId);

    expect(result).toEqual({
      artistId: validArtistId,
      requesterAccountId: authenticatedAccountId,
    });
  });
});
