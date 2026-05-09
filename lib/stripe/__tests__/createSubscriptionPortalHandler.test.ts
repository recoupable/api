import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createSubscriptionPortalHandler } from "@/lib/stripe/createSubscriptionPortalHandler";
import { validateCreateSubscriptionPortalBody } from "@/lib/stripe/validateCreateSubscriptionPortalBody";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/validateCreateSubscriptionPortalBody", () => ({
  validateCreateSubscriptionPortalBody: vi.fn(),
}));

vi.mock("@/lib/stripe/getActiveSubscriptionDetails", () => ({
  getActiveSubscriptionDetails: vi.fn(),
}));

vi.mock("@/lib/stripe/createBillingPortalSession", () => ({
  createBillingPortalSession: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("createSubscriptionPortalHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreateSubscriptionPortalBody).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/subscriptions/portal", {
      method: "POST",
      body: "{}",
    });
    expect(await createSubscriptionPortalHandler(req)).toBe(err);
    expect(getActiveSubscriptionDetails).not.toHaveBeenCalled();
  });

  it("returns 200 with id and url", async () => {
    vi.mocked(validateCreateSubscriptionPortalBody).mockResolvedValue({
      accountId: ACCOUNT,
      returnUrl: "https://chat.recoupable.com/billing",
    });
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue({
      customer: "cus_test_123",
    } as Awaited<ReturnType<typeof getActiveSubscriptionDetails>>);
    vi.mocked(createBillingPortalSession).mockResolvedValue({
      id: "bps_test_abc",
      url: "https://billing.example.com/session/abc",
    } as Awaited<ReturnType<typeof createBillingPortalSession>>);

    const res = await createSubscriptionPortalHandler(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "bps_test_abc",
      url: "https://billing.example.com/session/abc",
    });
  });

  it("returns 500 when createBillingPortalSession throws", async () => {
    vi.mocked(validateCreateSubscriptionPortalBody).mockResolvedValue({
      accountId: ACCOUNT,
      returnUrl: "https://chat.recoupable.com/billing",
    });
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue({
      customer: "cus_test_123",
    } as Awaited<ReturnType<typeof getActiveSubscriptionDetails>>);
    vi.mocked(createBillingPortalSession).mockRejectedValue(new Error("Stripe down"));

    const res = await createSubscriptionPortalHandler(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
