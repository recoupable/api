import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateTrackEmailBody } from "@/lib/email/validateTrackEmailBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const buildRequest = (body: string | undefined) =>
  new NextRequest("https://example.com/api/email", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });

describe("validateTrackEmailBody", () => {
  it("returns the validated body when email is valid", async () => {
    const request = buildRequest(JSON.stringify({ email: "test@example.com" }));

    const result = await validateTrackEmailBody(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result).toEqual({ email: "test@example.com" });
    }
  });

  it("returns 400 with `Invalid JSON body` when the request body is not JSON", async () => {
    const request = buildRequest("not-json");

    const result = await validateTrackEmailBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body).toEqual({ message: "Invalid JSON body" });
    }
  });

  it("returns 400 when email is missing", async () => {
    const request = buildRequest(JSON.stringify({}));

    const result = await validateTrackEmailBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(body.missing_fields).toEqual(["email"]);
    }
  });

  it("returns 400 when email is not a valid email address", async () => {
    const request = buildRequest(JSON.stringify({ email: "not-an-email" }));

    const result = await validateTrackEmailBody(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
    }
  });
});
