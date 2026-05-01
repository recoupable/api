import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchMetricsRequest } from "../validateGetResearchMetricsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateGetResearchMetricsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
  });

  it("returns 400 when source is missing", async () => {
    const result = await validateGetResearchMetricsRequest(
      new NextRequest("http://x/?artist=Drake"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toBe("source parameter is required");
    }
  });

  it("returns 400 when source is not in the allowed list", async () => {
    const result = await validateGetResearchMetricsRequest(
      new NextRequest("http://x/?artist=Drake&source=myspace"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toContain("Invalid source");
    }
  });

  it("delegates artist validation to validateArtistRequest (400 when artist missing)", async () => {
    const result = await validateGetResearchMetricsRequest(
      new NextRequest("http://x/?source=spotify"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toBe("artist parameter is required");
    }
  });

  it("returns accountId, artist, and source on success", async () => {
    const result = await validateGetResearchMetricsRequest(
      new NextRequest("http://x/?artist=Drake&source=spotify"),
    );
    expect(result).toEqual({ accountId: "acc_1", artist: "Drake", source: "spotify" });
  });
});
