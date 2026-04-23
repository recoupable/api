import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateStripeSessionBody } from "../validateCreateStripeSessionBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
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

const mockValidateAuthContext = vi.mocked(validateAuthContext);
const mockSafeParseJson = vi.mocked(safeParseJson);

function makeRequest(): NextRequest {
  return {
    headers: { get: (key: string) => (key === "x-api-key" ? "test-key" : null) },
  } as unknown as NextRequest;
}

describe("validateCreateStripeSessionBody auth errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through 401 from validateAuthContext", async () => {
    mockSafeParseJson.mockResolvedValue({
      successUrl: "https://chat.recoupable.com?success=1",
    });
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateCreateStripeSessionBody(makeRequest());

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("passes through 403 from validateAuthContext", async () => {
    mockSafeParseJson.mockResolvedValue({
      successUrl: "https://chat.recoupable.com?success=1",
      accountId: "123e4567-e89b-12d3-a456-426614174000",
    });
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Access denied" }, { status: 403 }),
    );

    const result = await validateCreateStripeSessionBody(makeRequest());

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });
});
