import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
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

describe("validateCreateStripeSessionBody success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns accountId and successUrl when valid", async () => {
    mockSafeParseJson.mockResolvedValue({
      successUrl: "https://chat.recoupable.com?success=1",
    });
    mockValidateAuthContext.mockResolvedValue({
      accountId: "account-uuid-111",
      orgId: null,
      authToken: "test-key",
    });

    const result = await validateCreateStripeSessionBody(makeRequest());

    expect(result).toEqual({
      accountId: "account-uuid-111",
      successUrl: "https://chat.recoupable.com?success=1",
    });
  });

  it("uses accountId override when provided and auth permits", async () => {
    const overrideId = "223e4567-e89b-12d3-a456-426614174001";
    mockSafeParseJson.mockResolvedValue({
      successUrl: "https://chat.recoupable.com?success=1",
      accountId: overrideId,
    });
    mockValidateAuthContext.mockResolvedValue({
      accountId: overrideId,
      orgId: null,
      authToken: "test-key",
    });

    const result = await validateCreateStripeSessionBody(makeRequest());

    expect(result).toEqual({
      accountId: overrideId,
      successUrl: "https://chat.recoupable.com?success=1",
    });
    expect(mockValidateAuthContext).toHaveBeenCalledWith(expect.anything(), {
      accountId: overrideId,
    });
  });
});
