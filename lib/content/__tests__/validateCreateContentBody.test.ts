import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateContentBody } from "@/lib/content/validateCreateContentBody";

const mockValidateAuthContext = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(async (req: Request) => req.json()),
}));

/**
 *
 * @param body
 */
function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/content/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
    body: JSON.stringify(body),
  });
}

describe("validateCreateContentBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "test-key",
    });
  });

  it("returns validated payload for a valid request", async () => {
    const request = createRequest({
      artist_slug: "gatsby-grace",
      template: "artist-caption-bedroom",
      lipsync: true,
    });

    const result = await validateCreateContentBody(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result).toEqual({
        accountId: "acc_123",
        artistSlug: "gatsby-grace",
        template: "artist-caption-bedroom",
        lipsync: true,
      });
    }
  });

  it("applies defaults when optional fields are omitted", async () => {
    const request = createRequest({
      artist_slug: "gatsby-grace",
    });

    const result = await validateCreateContentBody(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.template).toBe("artist-caption-bedroom");
      expect(result.lipsync).toBe(false);
    }
  });

  it("returns 400 when artist_slug is missing", async () => {
    const request = createRequest({
      template: "artist-caption-bedroom",
    });

    const result = await validateCreateContentBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });

  it("returns 400 when template is unsupported", async () => {
    const request = createRequest({
      artist_slug: "gatsby-grace",
      template: "not-a-real-template",
    });

    const result = await validateCreateContentBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toContain("Unsupported template");
    }
  });

  it("returns auth error response when auth fails", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );
    const request = createRequest({ artist_slug: "gatsby-grace" });

    const result = await validateCreateContentBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401);
    }
  });
});
