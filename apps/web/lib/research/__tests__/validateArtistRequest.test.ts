import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateArtistRequest } from "../validateArtistRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateArtistRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the auth response when validateAuthContext fails", async () => {
    const unauthorized = NextResponse.json({ error: "x" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(unauthorized);

    const result = await validateArtistRequest(new NextRequest("http://x/?artist=drake"));

    expect(result).toBe(unauthorized);
  });

  it("returns a 400 response when artist is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);

    const result = await validateArtistRequest(new NextRequest("http://x/"));

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toBe("artist parameter is required");
    }
  });

  it("returns accountId and artist on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);

    const result = await validateArtistRequest(new NextRequest("http://x/?artist=Drake"));

    expect(result).toEqual({ accountId: "acc_1", artist: "Drake" });
  });
});
