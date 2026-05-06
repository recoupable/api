import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAccountSubscriptionParams } from "@/lib/stripe/validateAccountSubscriptionParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

const getRequest = () =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/subscription`, {
    headers: { "x-api-key": "test-key" },
  });

describe("validateAccountSubscriptionParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when id is not a valid UUID", async () => {
    const res = await validateAccountSubscriptionParams(getRequest(), "not-a-uuid");
    expect(res).toBeInstanceOf(NextResponse);
    const response = res as NextResponse;
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/id must be a valid UUID/i);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("forwards the auth response when authentication fails", async () => {
    const denial = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(denial);

    const req = getRequest();
    const res = await validateAccountSubscriptionParams(req, ACCOUNT);
    expect(res).toBe(denial);
    expect(validateAuthContext).toHaveBeenCalledWith(req, { accountId: ACCOUNT });
  });

  it("returns the validated accountId when auth succeeds", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "tok",
    });

    const res = await validateAccountSubscriptionParams(getRequest(), ACCOUNT);
    expect(res).toBe(ACCOUNT);
  });
});
