import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateStripeSessionBody } from "../validateCreateStripeSessionBody";
import { safeParseJson } from "@/lib/networking/safeParseJson";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const mockSafeParseJson = vi.mocked(safeParseJson);

function makeRequest(): NextRequest {
  return {
    headers: { get: (key: string) => (key === "x-api-key" ? "test-key" : null) },
  } as unknown as NextRequest;
}

describe("validateCreateStripeSessionBody validation errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when successUrl is missing", async () => {
    mockSafeParseJson.mockResolvedValue({});
    const result = await validateCreateStripeSessionBody(makeRequest());
    expect(result).toBeInstanceOf(NextResponse);
    const data = await (result as NextResponse).json();
    expect((result as NextResponse).status).toBe(400);
    expect(data.error).toBe("successUrl is required");
  });

  it("returns 400 when successUrl is not a valid URL", async () => {
    mockSafeParseJson.mockResolvedValue({ successUrl: "not-a-url" });
    const result = await validateCreateStripeSessionBody(makeRequest());
    expect(result).toBeInstanceOf(NextResponse);
    const data = await (result as NextResponse).json();
    expect((result as NextResponse).status).toBe(400);
    expect(data.error).toBe("successUrl must be a valid URL");
  });

  it("returns 400 when accountId is not a valid UUID", async () => {
    mockSafeParseJson.mockResolvedValue({
      successUrl: "https://chat.recoupable.com?success=1",
      accountId: "not-a-uuid",
    });
    const result = await validateCreateStripeSessionBody(makeRequest());
    expect(result).toBeInstanceOf(NextResponse);
    const data = await (result as NextResponse).json();
    expect((result as NextResponse).status).toBe(400);
    expect(data.error).toBe("accountId must be a valid UUID");
  });
});
