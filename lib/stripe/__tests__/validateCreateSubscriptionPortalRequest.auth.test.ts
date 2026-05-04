import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateSubscriptionPortalRequest } from "@/lib/stripe/validateCreateSubscriptionPortalRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("validateCreateSubscriptionPortalRequest (auth)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps auth failure to { error } and preserves status", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );
    const req = new NextRequest("http://localhost/api/subscriptions/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnUrl: "https://chat.recoupable.com/billing" }),
    });
    const res = await validateCreateSubscriptionPortalRequest(req);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Exactly one of x-api-key or Authorization must be provided",
    });
  });

  it("passes accountId to validateAuthContext when provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "t",
    });
    const otherAccount = "123e4567-e89b-12d3-a456-426614174099";
    const req = new NextRequest("http://localhost/api/subscriptions/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({
        returnUrl: "https://chat.recoupable.com/billing",
        accountId: otherAccount,
      }),
    });
    await validateCreateSubscriptionPortalRequest(req);
    expect(validateAuthContext).toHaveBeenCalledWith(req, { accountId: otherAccount });
  });

  it("returns accountId and returnUrl when auth succeeds", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "t",
    });
    const req = new NextRequest("http://localhost/api/subscriptions/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({ returnUrl: "https://chat.recoupable.com/billing" }),
    });
    const out = await validateCreateSubscriptionPortalRequest(req);
    expect(out).toEqual({ accountId: ACCOUNT, returnUrl: "https://chat.recoupable.com/billing" });
    expect(validateAuthContext).toHaveBeenCalledWith(req, {});
  });
});
